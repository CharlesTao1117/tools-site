#!/usr/bin/env python3
import subprocess, sys

with open('/Users/calmestao/Desktop/tools-site/.review_prompt.md', 'r') as f:
    prompt = f.read()

cmd = ['hermes', 'chat', '-q', prompt, '-m', 'deepseek-v4-pro', '--provider', 'opencode-go']
proc = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
stdout = proc.stdout[-8000:] if len(proc.stdout) > 8000 else proc.stdout
stderr = proc.stderr[-2000:] if len(proc.stderr) > 2000 else proc.stderr
print("=== STDOUT ===")
print(stdout)
print("=== STDERR ===")
print(stderr)
print("=== EXIT ===", proc.returncode)
