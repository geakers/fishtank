package com.focusflip.app.ui.groups

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.focusflip.app.data.groups.GroupInvite
import com.focusflip.app.data.groups.GroupMember
import com.focusflip.app.data.groups.GroupsRepository
import com.focusflip.app.data.groups.StudyGroup
import com.focusflip.app.di.ServiceLocator
import com.focusflip.app.ui.theme.LcdPanel
import com.focusflip.app.ui.theme.Retro
import com.focusflip.app.ui.theme.RetroLink
import com.focusflip.app.ui.theme.RetroScreen
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Longest group name, as on the desktop. */
private const val MAX_GROUP_NAME_LENGTH = 40

/** How often the screen checks for new invites and groups. */
private const val REFRESH_MS = 30_000L

private data class Notice(val ok: Boolean, val text: String)

/**
 * Study groups, matching the desktop's panel (src/frontend/views/components/StudyGroups.tsx)
 * and the iOS app: a search box and NEW button, invites waiting for an answer, the user's
 * groups (tap one to see its people; its leader can invite more) and, while searching,
 * people to invite.
 */
@Composable
fun StudyGroupsScreen(onBack: () -> Unit) {
    val repo = ServiceLocator.groupsRepository
    val scope = rememberCoroutineScope()
    val session by ServiceLocator.sessionStore.session.collectAsStateWithLifecycle()
    val sync by ServiceLocator.syncRepository.status.collectAsStateWithLifecycle()
    val uid = session?.user?.id

    /** null until the first load finishes. */
    var groups by remember { mutableStateOf<List<StudyGroup>?>(null) }
    var invites by remember { mutableStateOf<List<GroupInvite>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var people by remember { mutableStateOf<List<String>>(emptyList()) }
    var creating by remember { mutableStateOf(false) }
    var newName by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var openGroupId by remember { mutableStateOf<Int?>(null) }
    var openPerson by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<Notice?>(null) }
    /** Goes up after each invite, so the open group reloads its people. */
    var rosterVersion by remember { mutableIntStateOf(0) }

    val search = query.trim()
    fun matches(name: String) = search.isEmpty() || name.contains(search, ignoreCase = true)
    val shownGroups = groups.orEmpty().filter { matches(it.name) }
    val shownInvites = invites.filter { matches(it.groupName) }
    val ledGroups = groups.orEmpty().filter { it.leaderId == uid }

    /** Database messages start lower case ("only the group leader can ..."). */
    fun fail(e: Throwable) {
        val text = e.message ?: "Something went wrong."
        notice = Notice(false, text.replaceFirstChar { it.uppercase() })
    }

    /** Returns false when the groups couldn't be loaded. */
    suspend fun refresh(): Boolean = try {
        groups = repo.listGroups()
        // Invites are an add-on to the groups database, so groups still load when invites can't.
        invites = runCatching { repo.myInvites() }.getOrDefault(emptyList())
        true
    } catch (e: Exception) {
        if (groups == null) groups = emptyList()
        false
    }

    fun createGroup() {
        if (busy || newName.isBlank()) return
        busy = true
        scope.launch {
            try {
                val created = repo.createGroup(newName)
                creating = false
                newName = ""
                query = ""
                openGroupId = created.id
                notice = Notice(true, "Created ${created.name}.")
                refresh()
            } catch (e: Exception) {
                fail(e)
            } finally {
                busy = false
            }
        }
    }

    fun invite(username: String, group: StudyGroup) {
        scope.launch {
            try {
                repo.invite(group.id, username)
                rosterVersion++
                notice = Notice(true, "Invited $username to ${group.name}.")
            } catch (e: Exception) {
                fail(e)
            }
        }
    }

    fun answer(invite: GroupInvite, accept: Boolean) {
        scope.launch {
            try {
                if (accept) {
                    repo.acceptInvite(invite.groupId)
                    openGroupId = invite.groupId
                    notice = Notice(true, "You joined ${invite.groupName}.")
                } else {
                    repo.declineInvite(invite.groupId)
                    notice = null
                }
            } catch (e: Exception) {
                fail(e)
            }
            refresh()
        }
    }

    LaunchedEffect(Unit) {
        if (!refresh()) notice = Notice(false, "Couldn't load your study groups.")
        while (true) {
            delay(REFRESH_MS)
            refresh()
        }
    }
    LaunchedEffect(search) {
        people = findPeople(search, listOfNotNull(sync.username), repo)
    }

    RetroScreen(Modifier.fillMaxSize()) {
        Column(
            Modifier
                .fillMaxSize()
                .windowInsetsPadding(WindowInsets.safeDrawing)
                .padding(16.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                RetroLink("< BACK", onClick = onBack)
                Spacer(Modifier.weight(1f))
                RetroLink(if (creating) "CANCEL" else "+ NEW", onClick = { creating = !creating; newName = "" })
            }
            Spacer(Modifier.height(8.dp))

            LcdPanel(Modifier.fillMaxWidth()) {
                Text("STUDY GROUPS", style = Retro.lcdText(22, bold = true))
                Text("Study with friends on any device.", style = Retro.lcdText(12))
                Spacer(Modifier.height(8.dp))
                if (creating) {
                    LcdTextField(
                        "Name your study group",
                        newName,
                        { newName = it.take(MAX_GROUP_NAME_LENGTH) },
                        onDone = { createGroup() },
                    )
                    Spacer(Modifier.height(8.dp))
                    Row {
                        Spacer(Modifier.weight(1f))
                        SmallButton(if (busy) "CREATING..." else "CREATE", primary = true, enabled = newName.isNotBlank() && !busy) {
                            createGroup()
                        }
                    }
                } else {
                    LcdTextField("Search people or groups...", query, { query = it })
                }
            }

            notice?.let {
                Text(
                    it.text,
                    style = Retro.lcdText(12, bold = true, color = if (it.ok) Retro.OnSky else Retro.EndRed),
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
            Spacer(Modifier.height(12.dp))

            LazyColumn(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                if (shownInvites.isNotEmpty()) {
                    item { Heading("INVITES") }
                    items(shownInvites, key = { "invite-${it.groupId}" }) { invite ->
                        InviteRow(invite) { accept -> answer(invite, accept) }
                    }
                }

                item { Heading(if (search.isEmpty()) "YOUR GROUPS" else "GROUPS") }
                when {
                    groups == null -> item { Muted("Loading...") }
                    shownGroups.isEmpty() -> item {
                        Muted(if (search.isEmpty()) "No study groups yet. Press + NEW to start one." else "No groups match.")
                    }
                }
                items(shownGroups, key = { "group-${it.id}" }) { group ->
                    val open = openGroupId == group.id
                    val isLeader = group.leaderId == uid
                    GlassCard(open) {
                        RowLabel(group.name, if (isLeader) "LEADER" else null, open) {
                            openGroupId = if (open) null else group.id
                        }
                        if (open) {
                            GroupPeople(group, isLeader, rosterVersion, repo) { username -> invite(username, group) }
                        }
                    }
                }

                if (search.isNotEmpty()) {
                    item { Heading("PEOPLE") }
                    if (people.isEmpty()) item { Muted("No people match.") }
                    items(people, key = { "person-$it" }) { username ->
                        val open = openPerson == username
                        GlassCard(open) {
                            RowLabel(username, null, open) { openPerson = if (open) null else username }
                            if (open) {
                                if (ledGroups.isEmpty()) Muted("Start a group with + NEW to invite $username.")
                                ledGroups.forEach { group ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text(
                                            group.name,
                                            style = Retro.lcdText(13),
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.weight(1f),
                                        )
                                        SmallButton("INVITE") { invite(username, group) }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * Usernames matching the query, minus the ones in [excluding]. Waits briefly first, so typing
 * doesn't send a search per keystroke (a new keystroke cancels the wait).
 */
private suspend fun findPeople(query: String, excluding: List<String>, repo: GroupsRepository): List<String> {
    if (query.isEmpty()) return emptyList()
    delay(250)
    val found = runCatching { repo.searchUsernames(query) }.getOrDefault(emptyList())
    return found.filter { it !in excluding }
}

/**
 * The drop-down under a group: everyone in it, anyone invited who hasn't answered yet and,
 * for the leader, an ADD button to invite more people.
 */
@Composable
private fun GroupPeople(
    group: StudyGroup,
    isLeader: Boolean,
    version: Int,
    repo: GroupsRepository,
    onInvite: (String) -> Unit,
) {
    var roster by remember { mutableStateOf<List<GroupMember>?>(null) }
    var invited by remember { mutableStateOf<List<String>>(emptyList()) }
    var failed by remember { mutableStateOf(false) }
    var adding by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var suggestions by remember { mutableStateOf<List<String>>(emptyList()) }
    val search = query.trim()
    val taken = roster.orEmpty().map { it.username } + invited

    LaunchedEffect(version) {
        try {
            val nextRoster = repo.roster(group.id)
            invited = if (isLeader) runCatching { repo.pendingInvites(group.id) }.getOrDefault(emptyList()) else emptyList()
            roster = nextRoster
            failed = false
        } catch (e: Exception) {
            failed = true
        }
    }
    LaunchedEffect(search, taken) {
        suggestions = findPeople(search, taken, repo)
    }

    Column(Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        if (failed) Text("Couldn't load this group.", style = Retro.lcdText(12, bold = true, color = Retro.EndRed))
        if (roster == null && !failed) Muted("Loading...")
        roster.orEmpty().forEach { PersonLine(it.username, if (it.role == "leader") "LEADER" else null) }
        invited.forEach { PersonLine(it, "INVITED", pending = true) }

        if (isLeader && !adding) SmallButton("+ ADD") { adding = true }
        if (isLeader && adding) {
            LcdTextField("Search by username...", query, { query = it })
            if (search.isNotEmpty() && suggestions.isEmpty()) Muted("No one else matches.")
            suggestions.forEach { username ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(username, style = Retro.lcdText(13), maxLines = 1, modifier = Modifier.weight(1f))
                    SmallButton("INVITE") { onInvite(username) }
                }
            }
        }
    }
}

// ------------------------------------------------------------ pieces

@Composable
private fun Heading(text: String) {
    Text(text, style = Retro.lcdText(13, bold = true, color = Retro.OnSky), modifier = Modifier.padding(top = 8.dp))
}

@Composable
private fun Muted(text: String) {
    Text(text, style = Retro.lcdText(12, color = Retro.OnSkyMuted))
}

/** A row on glass that turns into an LCD panel while it's open, like a checked whitelist row. */
@Composable
private fun GlassCard(open: Boolean, content: @Composable ColumnScope.() -> Unit) {
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(if (open) Retro.Lcd else Retro.Glass)
            .border(1.dp, if (open) Retro.LcdMid else Retro.GlassBorder, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        content = content,
    )
}

@Composable
private fun RowLabel(title: String, tag: String?, open: Boolean, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick), verticalAlignment = Alignment.CenterVertically) {
        Text(
            title,
            style = Retro.lcdText(15, bold = true, color = if (open) Retro.LcdInk else Retro.OnSky),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f, fill = false),
        )
        if (tag != null) {
            Spacer(Modifier.width(8.dp))
            Tag(tag)
        }
        Spacer(Modifier.weight(1f))
        Text(if (open) "▴" else "▾", style = Retro.lcdText(15, bold = true, color = Retro.LcdMid))
    }
}

@Composable
private fun Tag(text: String) {
    Text(
        text,
        style = Retro.lcdText(10, bold = true, color = Color.White),
        modifier = Modifier
            .clip(RoundedCornerShape(50))
            .background(Retro.LcdMid)
            .padding(horizontal = 6.dp, vertical = 2.dp),
    )
}

@Composable
private fun PersonLine(name: String, detail: String?, pending: Boolean = false) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(if (pending) "○" else "●", style = Retro.lcdText(11, color = Retro.LcdMid))
        Spacer(Modifier.width(8.dp))
        Text(name, style = Retro.lcdText(13, bold = !pending, color = if (pending) Retro.LcdMid else Retro.LcdInk), maxLines = 1)
        if (detail != null) {
            Spacer(Modifier.width(8.dp))
            if (pending) Text(detail, style = Retro.lcdText(10, color = Retro.LcdMid)) else Tag(detail)
        }
    }
}

@Composable
private fun InviteRow(invite: GroupInvite, onAnswer: (Boolean) -> Unit) {
    GlassCard(open = true) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(invite.groupName, style = Retro.lcdText(15, bold = true), maxLines = 1)
                Text("from ${invite.leader}", style = Retro.lcdText(11, color = Retro.LcdMid), maxLines = 1)
            }
            SmallButton("DECLINE") { onAnswer(false) }
            Spacer(Modifier.width(6.dp))
            SmallButton("ACCEPT", primary = true) { onAnswer(true) }
        }
    }
}

/** A compact pearl key for actions inside rows. */
@Composable
private fun SmallButton(text: String, primary: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    Box(
        Modifier
            .alpha(if (enabled) 1f else 0.5f)
            .clip(RoundedCornerShape(50))
            .then(if (primary) Modifier.background(Retro.CallGreen) else Modifier.background(Retro.silverBrush))
            .border(1.dp, Color.White, RoundedCornerShape(50))
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 6.dp),
    ) {
        Text(text, style = Retro.lcdText(11, bold = true, color = if (primary) Color.White else Retro.KeyText))
    }
}

/** A text box drawn on the LCD, like the whitelist's search. */
@Composable
private fun LcdTextField(placeholder: String, value: String, onChange: (String) -> Unit, onDone: (() -> Unit)? = null) {
    Box(
        Modifier
            .fillMaxWidth()
            .border(2.dp, Retro.LcdMid, RoundedCornerShape(4.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        if (value.isEmpty()) Text(placeholder, style = Retro.lcdText(14, color = Retro.LcdMid))
        BasicTextField(
            value = value,
            onValueChange = onChange,
            singleLine = true,
            textStyle = Retro.lcdText(14, bold = true),
            cursorBrush = SolidColor(Retro.LcdInk),
            keyboardOptions = KeyboardOptions(imeAction = if (onDone != null) ImeAction.Done else ImeAction.Default),
            keyboardActions = KeyboardActions(onDone = { onDone?.invoke() }),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}
