# -*- coding: utf-8 -*-
"""ST -> XML bridge for the DSH AgentPLC plugin.

Two interchangeable output formats share the same splitter:
  iec61131-10  IEC 61131-10 XML with the OMRON Smc extension, importable by Sysmac Studio.
  plcopen      PLCopen TC6 2.01 XML, the vendor-neutral exchange format for IEC 61131-3 code.

Usage:
  python convert_st.py --input <file-or-dir> [--input ...] --output <out.xml> \
      [--name NAME] [--only-fb] [--format iec61131-10|plcopen]

Prints one JSON document describing what was written.
"""
import argparse
import glob
import json
import os
import sys
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import st2plcopen  # noqa: E402
from st2plcopen import split_blocks  # noqa: E402
from st2iec61131 import emit  # noqa: E402


def collect(paths):
    files = []
    for path in paths:
        if os.path.isdir(path):
            files.extend(sorted(glob.glob(os.path.join(path, '*.st'))))
        elif os.path.isfile(path) and path.lower().endswith('.st'):
            files.append(path)
    unique = []
    seen = set()
    for path in files:
        absolute = os.path.abspath(path)
        key = absolute.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(absolute)
    return unique


def build_plcopen(blocks, name, only_fb=False):
    """Merge TYPE / FUNCTION_BLOCK / PROGRAM blocks into one PLCopen TC6 project."""
    data_types = []
    pous = []
    for kind, block, prefix in blocks:
        if kind == 'type':
            xml = st2plcopen.parse_struct(block)
            if xml:
                data_types.append(xml)
            continue
        if kind in ('fb', 'prog'):
            if kind == 'prog' and only_fb:
                continue
            xml = st2plcopen.parse_pou(block, 'fb' if kind == 'fb' else 'prog', prefix)
            if xml:
                pous.append(xml)
            continue
        if kind == 'code':
            if only_fb:
                continue
            code = st2plcopen.clean_code(block)
            if not code:
                continue
            body = ('<body><ST><xhtml xmlns="%s"><![CDATA[\n%s\n]]></xhtml></ST></body>'
                    % (st2plcopen.XHTML, code))
            pous.append('<pou name="%s" pouType="program"><interface/>%s</pou>'
                        % (st2plcopen.esc(name), body))
    return st2plcopen.build_xml(data_types, pous, name)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', action='append', default=[])
    parser.add_argument('--output', required=True)
    parser.add_argument('--name', default=None)
    parser.add_argument('--only-fb', action='store_true')
    parser.add_argument('--format', default='iec61131-10', choices=['iec61131-10', 'plcopen'])
    args = parser.parse_args()

    try:
        sources = collect(args.input)
        if not sources:
            raise SystemExit('no .st source files were found in: %s' % ', '.join(args.input))

        name = args.name or (os.path.splitext(os.path.basename(sources[0]))[0])
        blocks = []
        for path in sources:
            with open(path, encoding='utf-8-sig') as handle:
                blocks.extend(split_blocks(handle.read()))

        if args.format == 'plcopen':
            xml = build_plcopen(blocks, name, only_fb=args.only_fb)
            counts = {
                'dataTypes': xml.count('<dataType '),
                'functionBlocks': xml.count('pouType="functionBlock"'),
                'programs': xml.count('pouType="program"'),
            }
        else:
            xml = emit(blocks, name, only_fb=args.only_fb, prog_name=name)
            counts = {
                'dataTypes': xml.count('<DataTypeDecl '),
                'functionBlocks': xml.count('<FunctionBlock '),
                'programs': xml.count('<Program '),
            }

        output = os.path.abspath(args.output)
        directory = os.path.dirname(output)
        if directory and not os.path.isdir(directory):
            os.makedirs(directory, exist_ok=True)
        with open(output, 'w', encoding='utf-8', newline='\n') as handle:
            handle.write(xml)

        print(json.dumps({
            'ok': True,
            'output': output,
            'name': name,
            'format': args.format,
            'sources': sources,
            'bytes': len(xml.encode('utf-8')),
            'dataTypes': counts['dataTypes'],
            'functionBlocks': counts['functionBlocks'],
            'programs': counts['programs'],
        }, ensure_ascii=False))
    except SystemExit as error:
        print(json.dumps({'ok': False, 'error': str(error)}, ensure_ascii=False))
        return 2
    except Exception as error:  # noqa: BLE001 - one JSON failure report for the caller
        print(json.dumps({
            'ok': False,
            'error': str(error),
            'trace': traceback.format_exc(limit=4),
        }, ensure_ascii=False))
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
