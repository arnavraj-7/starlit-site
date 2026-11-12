"""Writes enhanced-LRC (word-timed) files for the original demo songs used in the site footage."""
import sys

SONGS = {
    'slow-satellites': {
        'start': 6.0,
        'lines': [
            ("We were counting all the lights above the town", 4.2),
            ("Every window like a star that fell to ground", 4.2),
            ("You said nothing ever stays the way it shines", 4.2),
            ("So we drew our names in chalk on summer lines", 4.4),
            ("Oh, slow satellites", 3.0, 'hold'),
            ("Turning in the dark", 3.0, 'hold'),
            ("Carry us tonight", 3.0, 'hold'),
            ("Over every heart", 3.6, 'hold'),
            ("I can hear the static singing in the rain", 4.2),
            ("Every signal brings you back to me again", 4.2),
            ("Hold the frequency, don't let it slip away", 4.2),
            ("We are only echoes of a brighter day", 4.6),
            ("Oh, slow satellites", 3.0, 'hold'),
            ("Turning in the dark", 3.0, 'hold'),
            ("Carry us tonight", 3.0, 'hold'),
            ("Over every heart", 12.0, 'hold'),
            ("And if the sky forgets the way we used to glow", 4.4),
            ("I'll keep a little light for you to follow home", 4.6),
            ("Slow satellites", 3.2, 'hold'),
            ("Turning, turning, slow", 6.0, 'hold'),
        ],
    },
}


def stamp(t):
    return f"{int(t // 60):02d}:{t % 60:05.2f}"


def build(song):
    t, out = song['start'], []
    for entry in song['lines']:
        text, span = entry[0], entry[1]
        hold = len(entry) > 2
        words = text.split()
        sing = span - 0.5 if not hold else min(span - 0.4, 0.42 * len(words) + 0.3)
        weights = [0.6 + len(w.strip(',.')) * 0.12 for w in words]
        if hold:
            weights[-1] += 1.6            # the last word is held: shows the swell
        total = sum(weights)
        parts, wt = [], t
        for w, k in zip(words, weights):
            parts.append(f"<{stamp(wt)}>{w}")
            wt += sing * k / total
        out.append(f"[{stamp(t)}]" + " ".join(parts))
        t += span
    out.append(f"[{stamp(t)}]")
    return "\n".join(out) + "\n", t


if __name__ == '__main__':
    name = sys.argv[1]
    text, end = build(SONGS[name])
    open(sys.argv[2], 'w', encoding='utf8').write(text)
    print(f"wrote {sys.argv[2]}, ends at {end:.1f}s")
