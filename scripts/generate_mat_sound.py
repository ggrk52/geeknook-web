import numpy as np
import wave
import struct

SAMPLE_RATE = 48000
DURATION = 5.8
NUM_SAMPLES = int(SAMPLE_RATE * DURATION)
t = np.linspace(0, DURATION, NUM_SAMPLES, endpoint=False)

left = np.zeros(NUM_SAMPLES)
right = np.zeros(NUM_SAMPLES)

# 1. Low-end ambient sub-pulse
sub_pulse = 0.22 * np.sin(2 * np.pi * 55 * t) * (0.8 + 0.2 * np.sin(2 * np.pi * 1.4 * t))
# Fade out sub-pulse gently near the end
sub_pulse *= np.clip((5.5 - t) / 0.5, 0, 1)
left += sub_pulse
right += sub_pulse

# 2. Tech Atmosphere / White noise hiss filtered
noise = np.random.uniform(-0.015, 0.015, NUM_SAMPLES)
air_envelope = np.clip((t - 0.2) / 1.0, 0, 1) * np.clip((5.2 - t) / 0.8, 0, 1)
left += noise * air_envelope
right += noise * air_envelope

# 3. Laser Sweep (t = 0.40s -> 0.75s)
laser_idx = (t >= 0.4) & (t <= 0.75)
t_laser = t[laser_idx] - 0.4
laser_freq = 2400 * np.exp(-12 * t_laser) + 300
phase_laser = 2 * np.pi * np.cumsum(laser_freq) / SAMPLE_RATE
laser_amp = 0.35 * np.sin(np.pi * (t_laser / 0.35))
left[laser_idx] += laser_amp * np.sin(phase_laser) * 0.7
right[laser_idx] += laser_amp * np.sin(phase_laser) * 1.0

# 4. CAD Micro-clicks (t = 1.8s, 1.95s, 2.1s)
for click_time in [1.80, 1.95, 2.10]:
    click_idx = (t >= click_time) & (t <= click_time + 0.035)
    dt = t[click_idx] - click_time
    click_tone = 0.28 * np.sin(2 * np.pi * 3200 * dt) * np.exp(-dt * 140)
    left[click_idx] += click_tone
    right[click_idx] += click_tone

# 5. Bass Drop Transition at t = 2.85s
drop_idx = (t >= 2.85) & (t <= 4.05)
dt_drop = t[drop_idx] - 2.85
drop_freq = 85 * np.exp(-3.2 * dt_drop) + 32
drop_phase = 2 * np.pi * np.cumsum(drop_freq) / SAMPLE_RATE
drop_amp = 0.55 * np.exp(-dt_drop * 2.2)
left[drop_idx] += drop_amp * np.sin(drop_phase)
right[drop_idx] += drop_amp * np.sin(drop_phase)

# 6. Hydrophobic Water Droplet Resonances (t = 3.20s, 3.45s, 3.70s)
droplets = [
    (3.20, 1450, 950, 0.08, 0.45, 0.75),   # (time, start_freq, end_freq, dur, amp, pan_left)
    (3.45, 1720, 1100, 0.07, 0.40, 0.35),
    (3.70, 1300, 880, 0.09, 0.38, 0.55),
]

for drop_t, f_start, f_end, dur, amp, pan_l in droplets:
    d_idx = (t >= drop_t) & (t <= drop_t + dur)
    dt_d = t[d_idx] - drop_t
    # Exponential frequency sweep down (classic water drip acoustic physics)
    freqs = f_end + (f_start - f_end) * np.exp(-dt_d * 35)
    phase_d = 2 * np.pi * np.cumsum(freqs) / SAMPLE_RATE
    # Envelope: instant attack, exponential acoustic decay with subtle 2nd harmonic
    env = amp * np.exp(-dt_d * 42)
    harm2 = 0.25 * np.sin(2 * phase_d)
    drop_tone = env * (np.sin(phase_d) + harm2)
    left[d_idx] += drop_tone * pan_l
    right[d_idx] += drop_tone * (1.0 - pan_l)

# 7. Outro Brand Strike at t = 4.35s
outro_idx = (t >= 4.35) & (t <= 5.75)
dt_outro = t[outro_idx] - 4.35
strike = 0.45 * np.sin(2 * np.pi * 110 * dt_outro) * np.exp(-dt_outro * 3.5)
strike_metal = 0.22 * np.sin(2 * np.pi * 880 * dt_outro) * np.exp(-dt_outro * 6.5)
left[outro_idx] += strike + strike_metal
right[outro_idx] += strike + strike_metal

# Master Peak Limiting / Normalization (-1.0 dBFS)
max_val = max(np.max(np.abs(left)), np.max(np.abs(right)))
if max_val > 0:
    left = (left / max_val) * 0.89
    right = (right / max_val) * 0.89

# Export 16-bit 48kHz Stereo WAV
out_wav = 'motion/desk-mat-teaser/audio.wav'
with wave.open(out_wav, 'wb') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SAMPLE_RATE)
    interleaved = np.empty((NUM_SAMPLES * 2,), dtype=np.int16)
    interleaved[0::2] = (left * 32767).astype(np.int16)
    interleaved[1::2] = (right * 32767).astype(np.int16)
    wf.writeframes(interleaved.tobytes())

print(f"Synthesized Desk Mat audio design saved -> {out_wav}")
