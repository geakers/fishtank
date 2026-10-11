import SwiftUI

/// Longest group name, as on the desktop.
private let maxGroupNameLength = 40

private struct Notice: Equatable {
    var ok: Bool
    var text: String
}

/// Study groups, matching the desktop's panel (src/frontend/views/components/StudyGroups.tsx):
/// a search box and NEW button, invites waiting for an answer, the user's groups (tap one to
/// see its people; its leader can invite more) and, while searching, people to invite.
struct StudyGroupsScreen: View {
    @EnvironmentObject private var model: AppModel
    let onBack: () -> Void

    /// nil until the first load finishes.
    @State private var groups: [StudyGroup]?
    @State private var invites: [GroupInvite] = []
    @State private var query = ""
    @State private var people: [String] = []
    @State private var creating = false
    @State private var newName = ""
    @State private var busy = false
    @State private var openGroupId: Int?
    @State private var openPerson: String?
    @State private var notice: Notice?
    /// Goes up after each invite, so the open group reloads its people.
    @State private var rosterVersion = 0

    private var uid: String? { model.sessionStore.session?.user.id }
    private var search: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var shownGroups: [StudyGroup] { (groups ?? []).filter { matches($0.name) } }
    private var shownInvites: [GroupInvite] { invites.filter { matches($0.groupName) } }
    private var ledGroups: [StudyGroup] { (groups ?? []).filter { $0.leaderId == uid } }

    var body: some View {
        AeroBackground {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    RetroLink(text: "< BACK", action: onBack)
                    Spacer()
                    RetroLink(text: creating ? "CANCEL" : "+ NEW") {
                        creating.toggle()
                        newName = ""
                    }
                }
                .padding(.bottom, 8)

                LcdPanel {
                    Text("STUDY GROUPS").font(lcdFont(22, bold: true)).foregroundStyle(Palette.lcdInk)
                    Text("Study with friends on any device.").font(lcdFont(12)).foregroundStyle(Palette.lcdInk)
                    Spacer().frame(height: 8)
                    if creating {
                        LcdTextField(placeholder: "Name your study group", text: $newName)
                            .onChange(of: newName) { value in
                                if value.count > maxGroupNameLength { newName = String(value.prefix(maxGroupNameLength)) }
                            }
                            .onSubmit { Task { await createGroup() } }
                        Spacer().frame(height: 8)
                        HStack {
                            Spacer()
                            SmallButton(text: busy ? "CREATING..." : "CREATE", primary: true) {
                                Task { await createGroup() }
                            }
                            .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty || busy)
                        }
                    } else {
                        LcdTextField(placeholder: "Search people or groups...", text: $query)
                    }
                }

                if let notice {
                    Text(notice.text)
                        .font(lcdFont(12, bold: true))
                        .foregroundStyle(notice.ok ? Palette.onSky : Palette.endRed)
                        .padding(.top, 8)
                }

                Spacer().frame(height: 12)

                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 6) {
                        if !shownInvites.isEmpty {
                            Heading("INVITES")
                            ForEach(shownInvites) { invite in
                                InviteRow(invite: invite) { accept in
                                    Task { await answer(invite, accept: accept) }
                                }
                            }
                        }

                        Heading(search.isEmpty ? "YOUR GROUPS" : "GROUPS")
                        if groups == nil {
                            Muted("Loading...")
                        } else if shownGroups.isEmpty {
                            Muted(search.isEmpty ? "No study groups yet. Press + NEW to start one." : "No groups match.")
                        }
                        ForEach(shownGroups) { group in
                            groupRow(group)
                        }

                        if !search.isEmpty {
                            Heading("PEOPLE")
                            if people.isEmpty { Muted("No people match.") }
                            ForEach(people, id: \.self) { username in
                                personRow(username)
                            }
                        }
                    }
                }
                .refreshable { await refresh() }
            }
            .padding(16)
        }
        .task {
            if !(await refresh()) { notice = Notice(ok: false, text: "Couldn't load your study groups.") }
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: UInt64(Config.groupsRefreshSeconds * 1_000_000_000))
                if Task.isCancelled { break }
                await refresh()
            }
        }
        .task(id: search) {
            people = await findPeople(search, excluding: model.sync.status.username.map { [$0] } ?? [], groups: model.groups)
        }
    }

    // MARK: - Rows

    @ViewBuilder
    private func groupRow(_ group: StudyGroup) -> some View {
        let open = openGroupId == group.id
        let isLeader = group.leaderId == uid
        GlassCard(open: open) {
            Button {
                openGroupId = open ? nil : group.id
            } label: {
                RowLabel(title: group.name, tag: isLeader ? "LEADER" : nil, open: open)
            }
            .buttonStyle(.plain)
            if open {
                GroupPeople(group: group, isLeader: isLeader, version: rosterVersion) { username in
                    await invite(username, to: group)
                }
            }
        }
    }

    @ViewBuilder
    private func personRow(_ username: String) -> some View {
        let open = openPerson == username
        GlassCard(open: open) {
            Button {
                openPerson = open ? nil : username
            } label: {
                RowLabel(title: username, tag: nil, open: open)
            }
            .buttonStyle(.plain)
            if open {
                if ledGroups.isEmpty {
                    Muted("Start a group with + NEW to invite \(username).")
                }
                ForEach(ledGroups) { group in
                    HStack {
                        Text(group.name).font(lcdFont(13)).foregroundStyle(Palette.lcdInk).lineLimit(1)
                        Spacer()
                        SmallButton(text: "INVITE") { Task { await invite(username, to: group) } }
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func matches(_ name: String) -> Bool {
        search.isEmpty || name.localizedCaseInsensitiveContains(search)
    }

    /// Returns false when the groups couldn't be loaded.
    @discardableResult
    private func refresh() async -> Bool {
        do {
            groups = try await model.groups.listGroups()
            // Invites are an add-on to the groups database, so groups still load when invites can't.
            invites = (try? await model.groups.myInvites()) ?? []
            return true
        } catch {
            if groups == nil { groups = [] }
            return false
        }
    }

    private func createGroup() async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let created = try await model.groups.createGroup(name: newName)
            creating = false
            newName = ""
            query = ""
            openGroupId = created.id
            notice = Notice(ok: true, text: "Created \(created.name).")
            await refresh()
        } catch {
            fail(error)
        }
    }

    private func invite(_ username: String, to group: StudyGroup) async {
        do {
            try await model.groups.invite(groupId: group.id, username: username)
            rosterVersion += 1
            notice = Notice(ok: true, text: "Invited \(username) to \(group.name).")
        } catch {
            fail(error)
        }
    }

    private func answer(_ invite: GroupInvite, accept: Bool) async {
        do {
            if accept {
                try await model.groups.acceptInvite(groupId: invite.groupId)
                openGroupId = invite.groupId
                notice = Notice(ok: true, text: "You joined \(invite.groupName).")
            } else {
                try await model.groups.declineInvite(groupId: invite.groupId)
                notice = nil
            }
        } catch {
            fail(error)
        }
        await refresh()
    }

    /// Database messages start lower case ("only the group leader can ...").
    private func fail(_ error: Error) {
        let text = error.localizedDescription
        notice = Notice(ok: false, text: text.prefix(1).uppercased() + text.dropFirst())
    }
}

/// Usernames matching the query, minus the ones in `excluding`. Waits briefly first, so
/// typing doesn't send a search per keystroke (a new keystroke cancels the wait).
@MainActor
private func findPeople(_ query: String, excluding: [String], groups: GroupsRepository) async -> [String] {
    guard !query.isEmpty else { return [] }
    try? await Task.sleep(nanoseconds: 250_000_000)
    if Task.isCancelled { return [] }
    let found = (try? await groups.searchUsernames(query)) ?? []
    return found.filter { !excluding.contains($0) }
}

/// The drop-down under a group: everyone in it, anyone invited who hasn't answered yet
/// and, for the leader, an ADD button to invite more people.
private struct GroupPeople: View {
    @EnvironmentObject private var model: AppModel
    let group: StudyGroup
    let isLeader: Bool
    /// Reloads the people each time it changes.
    let version: Int
    let onInvite: (String) async -> Void

    @State private var roster: [GroupMember]?
    @State private var invited: [String] = []
    @State private var failed = false
    @State private var adding = false
    @State private var query = ""
    @State private var suggestions: [String] = []

    private var search: String { query.trimmingCharacters(in: .whitespacesAndNewlines) }
    private var taken: [String] { (roster ?? []).map(\.username) + invited }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            if failed { Text("Couldn't load this group.").font(lcdFont(12, bold: true)).foregroundStyle(Palette.endRed) }
            if roster == nil && !failed { Muted("Loading...") }
            ForEach(roster ?? [], id: \.username) { member in
                PersonLine(name: member.username, detail: member.role == "leader" ? "LEADER" : nil)
            }
            ForEach(invited, id: \.self) { username in
                PersonLine(name: username, detail: "INVITED", pending: true)
            }

            if isLeader && !adding {
                SmallButton(text: "+ ADD") { adding = true }
            }
            if isLeader && adding {
                LcdTextField(placeholder: "Search by username...", text: $query)
                if !search.isEmpty && suggestions.isEmpty { Muted("No one else matches.") }
                ForEach(suggestions, id: \.self) { username in
                    HStack {
                        Text(username).font(lcdFont(13)).foregroundStyle(Palette.lcdInk).lineLimit(1)
                        Spacer()
                        SmallButton(text: "INVITE") { Task { await onInvite(username) } }
                    }
                }
            }
        }
        .padding(.top, 6)
        .task(id: version) { await load() }
        .task(id: "\(search)|\(taken.joined(separator: ","))") {
            suggestions = await findPeople(search, excluding: taken, groups: model.groups)
        }
    }

    private func load() async {
        do {
            let nextRoster = try await model.groups.roster(groupId: group.id)
            invited = isLeader ? ((try? await model.groups.pendingInvites(groupId: group.id)) ?? []) : []
            roster = nextRoster
            failed = false
        } catch {
            failed = true
        }
    }
}

// MARK: - Pieces

private struct Heading: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(lcdFont(13, bold: true))
            .foregroundStyle(Palette.onSky)
            .padding(.top, 8)
    }
}

private struct Muted: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text).font(lcdFont(12)).foregroundStyle(Palette.onSkyMuted)
    }
}

/// A row on glass that turns into an LCD panel while it's open, like a checked whitelist row.
private struct GlassCard<Content: View>: View {
    let open: Bool
    @ViewBuilder var content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 6, content: content)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(open ? Palette.lcd : Palette.glass)
            .clipShape(RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(open ? Palette.lcdMid : Palette.glassBorder, lineWidth: 1))
    }
}

private struct RowLabel: View {
    let title: String
    let tag: String?
    let open: Bool

    var body: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(lcdFont(15, bold: true))
                .foregroundStyle(open ? Palette.lcdInk : Palette.onSky)
                .lineLimit(1)
            if let tag { Tag(text: tag) }
            Spacer()
            Text(open ? "▴" : "▾").font(lcdFont(15, bold: true)).foregroundStyle(Palette.lcdMid)
        }
        .contentShape(Rectangle())
    }
}

private struct Tag: View {
    let text: String
    var body: some View {
        Text(text)
            .font(lcdFont(10, bold: true))
            .foregroundStyle(.white)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .background(Palette.lcdMid)
            .clipShape(Capsule())
    }
}

private struct PersonLine: View {
    let name: String
    let detail: String?
    var pending = false

    var body: some View {
        HStack(spacing: 8) {
            Text(pending ? "○" : "●").font(lcdFont(11)).foregroundStyle(Palette.lcdMid)
            Text(name)
                .font(lcdFont(13, bold: !pending))
                .foregroundStyle(pending ? Palette.lcdMid : Palette.lcdInk)
                .lineLimit(1)
            if let detail {
                if pending {
                    Text(detail).font(lcdFont(10)).foregroundStyle(Palette.lcdMid)
                } else {
                    Tag(text: detail)
                }
            }
            Spacer()
        }
    }
}

private struct InviteRow: View {
    let invite: GroupInvite
    let onAnswer: (Bool) -> Void

    var body: some View {
        GlassCard(open: true) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(invite.groupName).font(lcdFont(15, bold: true)).foregroundStyle(Palette.lcdInk).lineLimit(1)
                    Text("from \(invite.leader)").font(lcdFont(11)).foregroundStyle(Palette.lcdMid).lineLimit(1)
                }
                Spacer()
                SmallButton(text: "DECLINE") { onAnswer(false) }
                SmallButton(text: "ACCEPT", primary: true) { onAnswer(true) }
            }
        }
    }
}

/// A compact pearl key for actions inside rows.
private struct SmallButton: View {
    let text: String
    var primary = false
    let action: () -> Void
    @Environment(\.isEnabled) private var isEnabled

    var body: some View {
        Button(action: action) {
            Text(text)
                .font(lcdFont(11, bold: true))
                .foregroundStyle(primary ? .white : Palette.keyText)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(primary ? AnyShapeStyle(Palette.callGreen) : AnyShapeStyle(Palette.pearlBrush))
                .clipShape(Capsule())
                .overlay(Capsule().stroke(Color.white, lineWidth: 1))
                .opacity(isEnabled ? 1 : 0.5)
        }
        .buttonStyle(.plain)
    }
}

/// A text box drawn on the LCD, like the whitelist's search.
private struct LcdTextField: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        ZStack(alignment: .leading) {
            if text.isEmpty {
                Text(placeholder).font(lcdFont(14)).foregroundStyle(Palette.lcdMid)
            }
            TextField("", text: $text)
                .font(lcdFont(14, bold: true))
                .foregroundStyle(Palette.lcdInk)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .overlay(RoundedRectangle(cornerRadius: 4).stroke(Palette.lcdMid, lineWidth: 2))
    }
}
