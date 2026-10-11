import AVFoundation
import Foundation

/// DTMF keypad tones on the media (playback) session so the volume buttons work.
final class TonePlayer {
    private var engine: AVAudioEngine?
    private var timer: Timer?

    func play(_ key: Character) {
        let pair: (Double, Double)
        switch key {
        case "1": pair = (697, 1209)
        case "2": pair = (697, 1336)
        case "3": pair = (697, 1477)
        case "4": pair = (770, 1209)
        case "5": pair = (770, 1336)
        case "6": pair = (770, 1477)
        case "7": pair = (852, 1209)
        case "8": pair = (852, 1336)
        case "9": pair = (852, 1477)
        case "*": pair = (941, 1209)
        case "0": pair = (941, 1336)
        case "#": pair = (941, 1477)
        default: pair = (800, 800)
        }
        play(f1: pair.0, f2: pair.1, ms: 90)
    }

    private func play(f1: Double, f2: Double, ms: Int) {
        stop()
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try? session.setActive(true)

        let engine = AVAudioEngine()
        let src = AVAudioSourceNode { _, _, frameCount, audioBufferList -> OSStatus in
            let abl = UnsafeMutableAudioBufferListPointer(audioBufferList)
            let rate = 44100.0
            for frame in 0..<Int(frameCount) {
                let t = Double(frame) / rate
                let sample = Float(0.22 * (sin(2 * .pi * f1 * t) + sin(2 * .pi * f2 * t)))
                for buf in abl {
                    buf.mData?.assumingMemoryBound(to: Float.self)[frame] = sample
                }
            }
            return noErr
        }
        engine.attach(src)
        engine.connect(src, to: engine.mainMixerNode, format: AVAudioFormat(standardFormatWithSampleRate: 44100, channels: 1))
        try? engine.start()
        self.engine = engine
        timer = Timer.scheduledTimer(withTimeInterval: Double(ms) / 1000, repeats: false) { [weak self] _ in
            self?.stop()
        }
    }

    func stop() {
        timer?.invalidate()
        timer = nil
        engine?.stop()
        engine = nil
    }
}
