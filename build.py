#!/usr/bin/env python3
"""Bundle src/ into one self-contained page: dist/index.html

The simulator is plain HTML + CSS + JavaScript with no dependencies.
This script inlines styles.css and every src/js/*.js file (in file-name order)
into src/index.html so the result works offline and on GitHub Pages.

Usage:  python build.py            -> dist/index.html
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent


def build() -> pathlib.Path:
    html = (ROOT / 'src' / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'src' / 'styles.css').read_text(encoding='utf-8')
    js = '\n'.join(p.read_text(encoding='utf-8') for p in sorted((ROOT / 'src' / 'js').glob('*.js')))
    # the page keeps a copy of its own shell so it can write stand-alone circuit files
    js = js.replace('/*@@SHELL@@*/null', json.dumps(html).replace('</', '<\\/'))
    out = html.replace('/*@@CSS@@*/', css).replace('/*@@JS@@*/', js)
    dist = ROOT / 'dist'
    dist.mkdir(exist_ok=True)
    target = dist / 'index.html'
    target.write_text(out, encoding='utf-8', newline='\n')
    (dist / '.nojekyll').write_text('', encoding='utf-8')
    return target


if __name__ == '__main__':
    path = build()
    print(f'built {path.relative_to(ROOT)} ({path.stat().st_size // 1024} KB)')
