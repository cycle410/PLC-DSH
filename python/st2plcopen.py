# -*- coding: utf-8 -*-
"""
把案例里的 .st 文件转成 PLCopen XML（IEC 61131-10 / TC6 2.01）

用法：python st2plcopen.py <输入目录> <输出目录>
"""
import os, re, sys, html, glob

NS = "http://www.plcopen.org/xml/tc6_0201"
XHTML = "http://www.w3.org/1999/xhtml"

ELEM = {
    "BOOL", "SINT", "INT", "DINT", "LINT",
    "USINT", "UINT", "UDINT", "ULINT",
    "REAL", "LREAL", "TIME", "DATE", "DT", "TOD",
    "BYTE", "WORD", "DWORD", "LWORD", "STRING", "WSTRING",
}


# ---------------------------------------------------------------- 工具
def strip_line_comment(s):
    """拆出 // 注释"""
    i = s.find("//")
    if i >= 0:
        return s[:i], s[i + 2:].strip()
    return s, ""


def esc(s):
    return html.escape(s, quote=False)


def typ_xml(t):
    """类型字符串 -> XML 片段"""
    t = t.strip()
    m = re.match(r"ARRAY\s*\[\s*(-?\d+)\s*\.\.\s*(-?\d+)\s*\]\s*OF\s+(.+)$", t, re.I)
    if m:
        lo, hi, base = m.group(1), m.group(2), m.group(3).strip()
        inner = "<%s/>" % base if base.upper() in ELEM else '<derived name="%s"/>' % esc(base)
        return ('<type><array><dimension lower="%s" upper="%s"/>'
                "<baseType>%s</baseType></array></type>" % (lo, hi, inner))
    if t.upper() in ELEM:
        return "<type><%s/></type>" % t.upper()
    return '<type><derived name="%s"/></type>' % esc(t)


def var_xml(line):
    """一行变量声明 -> <variable> 片段；不是变量返回 None"""
    core, cmt = strip_line_comment(line)
    core = core.strip()
    if not core or ":" not in core:
        return None
    if not re.match(r"^[A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*\s*:", core):
        return None
    body = core.rstrip(";")
    m = re.match(r"^([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*:\s*(.+?)\s*(?::=\s*(.+))?$", body)
    if not m:
        return None
    name, typ, init = m.group(1), m.group(2), m.group(3)
    # 类型里可能被 := 截断，重新切一次
    if ":=" in typ:
        typ, init = typ.split(":=", 1)
    out = ['<variable name="%s">' % esc(name), typ_xml(typ.strip())]
    if init and init.strip():
        out.append('<initialValue><simpleValue value="%s"/></initialValue>' % esc(init.strip()))
    if cmt:
        out.append("<documentation>%s</documentation>" % esc(cmt))
    out.append("</variable>")
    return "".join(out)


# ---------------------------------------------------------------- 解析
def parse_struct(block):
    """TYPE X : STRUCT ... END_STRUCT END_TYPE"""
    m = re.match(r"TYPE\s+(\w+)\s*:\s*STRUCT(.*?)END_STRUCT", block, re.S | re.I)
    if not m:
        return None
    name, inner = m.group(1), m.group(2)
    vars_ = []
    for line in inner.splitlines():
        v = var_xml(line)
        if v:
            vars_.append(v)
    return ('<dataType name="%s"><baseType><struct>%s</struct></baseType></dataType>'
            % (esc(name), "".join(vars_)))


SEC_ORDER = ["VAR_INPUT", "VAR_OUTPUT", "VAR_IN_OUT", "VAR_EXTERNAL", "VAR", "VAR_TEMP"]


def parse_pou(block, kind, prefix=""):
    """FUNCTION_BLOCK / PROGRAM"""
    kw = "FUNCTION_BLOCK" if kind == "fb" else "PROGRAM"
    m = re.search(r"%s\s+(\w+)" % kw, block, re.I)
    if not m:
        return None
    name = m.group(1)
    rest = block[m.end():]

    # 截取到 END_FUNCTION_BLOCK / END_PROGRAM
    endm = re.search(r"END_(?:FUNCTION_BLOCK|PROGRAM)", rest, re.I)
    rest = rest[:endm.start()] if endm else rest

    sections = {}
    body_start = len(rest)
    pos = 0
    while True:
        sm = re.search(r"\b(VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_EXTERNAL|VAR_TEMP|VAR)\b", rest[pos:], re.I)
        if not sm:
            break
        s0 = pos + sm.start()
        em = re.search(r"\bEND_VAR\b", rest[s0:], re.I)
        if not em:
            break
        e0 = s0 + em.end()
        sec = sm.group(1).upper()
        inner = rest[s0 + len(sm.group(1)): s0 + em.start()]
        vs = []
        for line in inner.splitlines():
            v = var_xml(line)
            if v:
                vs.append(v)
        sections.setdefault(sec, []).extend(vs)
        pos = e0
        body_start = e0

    body = rest[body_start:].strip()
    if prefix:
        body = prefix + "\n\n" + body if body else prefix

    def sec_xml(tag, items):
        if not items:
            return ""
        return "<%s>%s</%s>" % (tag, "".join(items), tag)

    iface = ("<interface>"
             + sec_xml("inputVars", sections.get("VAR_INPUT"))
             + sec_xml("outputVars", sections.get("VAR_OUTPUT"))
             + sec_xml("inOutVars", sections.get("VAR_IN_OUT"))
             + sec_xml("localVars", sections.get("VAR"))
             + sec_xml("tempVars", sections.get("VAR_TEMP"))
             + "</interface>")

    bodyxml = ""
    if body:
        bodyxml = ('<body><ST><xhtml xmlns="%s"><![CDATA[\n%s\n]]></xhtml></ST></body>'
                   % (XHTML, body))

    pou_type = "functionBlock" if kind == "fb" else "program"
    return ('<pou name="%s" pouType="%s">%s%s</pou>'
            % (esc(name), pou_type, iface, bodyxml))


def split_blocks(text):
    """把文件切成 TYPE / FUNCTION_BLOCK / PROGRAM / 裸代码 块。
    紧挨在块前面的「纯注释」块会并入该块（保留说明文字）。"""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    pat = re.compile(
        r"(TYPE\s+\w+\s*:\s*STRUCT.*?END_TYPE)"
        r"|(FUNCTION_BLOCK\s+\w+.*?END_FUNCTION_BLOCK)"
        r"|(PROGRAM\s+\w+.*?END_PROGRAM)",
        re.S | re.I)
    raw = []
    last = 0
    for m in pat.finditer(text):
        pre = text[last:m.start()]
        blk = m.group(0)
        if m.group(1):
            kw = "type"
        elif m.group(2):
            kw = "fb"
        else:
            kw = "prog"
        raw.append((kw, blk, pre))
        last = m.end()
    tail = text[last:]

    def only_comment(s):
        s = re.sub(r"\(\*.*?\*\)", " ", s, flags=re.S)
        s = re.sub(r"//[^\n]*", " ", s).strip()
        return s == ""

    blocks = []
    pending = ""
    for kw, blk, pre in raw:
        pre_txt = pre.strip()
        if pre_txt and not only_comment(pre_txt):
            # 前面有实质代码 → 当成裸代码块
            if pending:
                blocks.append(("code", pending))
                pending = ""
            blocks.append(("code", pre_txt))
        elif pre_txt:
            pending = (pending + "\n" + pre_txt).strip()
        blocks.append((kw, blk, pending))
        pending = ""
    tail_txt = tail.strip()
    if tail_txt:
        if only_comment(tail_txt):
            if blocks:
                k, b, p = blocks[-1]
                blocks[-1] = (k, b, (p + "\n" + tail_txt).strip())
        else:
            blocks.append(("code", tail_txt, ""))
    return blocks


def clean_code(code):
    """裸代码：去掉首尾空行；如果只剩注释则返回空串（不生成 POU）"""
    lines = code.splitlines()
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    txt = "\n".join(lines)
    # 去掉块注释和行注释，看还剩什么实质内容
    probe = re.sub(r"\(\*.*?\*\)", " ", txt, flags=re.S)
    probe = re.sub(r"//[^\n]*", " ", probe).strip()
    if not probe:
        return ""
    return txt


# ---------------------------------------------------------------- 生成
def build_xml(dataTypes, pous, name):
    dt = "".join(dataTypes)
    po = "".join(pous)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<project xmlns="%s" schemaVersion="1.0"\n'
        '         xmlns:xhtml="%s"\n'
        '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">\n'
        '  <fileHeader companyName="AgentPLC" productName="ST Framework"\n'
        '              productVersion="1.0" creationDateTime="2026-11-13T09:00:00"/>\n'
        '  <contentHeader name="%s" version="1.0"/>\n'
        '  <types>\n'
        '    <dataTypes>%s</dataTypes>\n'
        '    <pous>%s</pous>\n'
        '  </types>\n'
        '  <instances/>\n'
        '</project>\n'
    ) % (NS, XHTML, esc(name), dt, po)


def convert_file(path, outdir):
    base = os.path.splitext(os.path.basename(path))[0]
    text = open(path, encoding="utf-8-sig").read()
    blocks = split_blocks(text)

    dataTypes, pous = [], []
    for kind, blk, prefix in blocks:
        if kind == "type":
            x = parse_struct(blk)
            if x:
                dataTypes.append(x)
        elif kind == "fb":
            x = parse_pou(blk, "fb", prefix)
            if x:
                pous.append(x)
        elif kind == "prog":
            x = parse_pou(blk, "prog", prefix)
            if x:
                pous.append(x)
        elif kind == "code":
            code = clean_code(blk)
            if not code:
                continue
            # 裸代码 -> 包一个 PROGRAM
            pname = base.split("_")[-1]
            bodyxml = ('<body><ST><xhtml xmlns="%s"><![CDATA[\n%s\n]]></xhtml></ST></body>'
                       % (XHTML, code))
            pous.append('<pou name="%s" pouType="program"><interface/>%s</pou>'
                        % (esc(pname), bodyxml))

    xml = build_xml(dataTypes, pous, base)
    out = os.path.join(outdir, base + ".xml")
    open(out, "w", encoding="utf-8").write(xml)
    return out, len(dataTypes), len(pous)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "."
    dst = sys.argv[2] if len(sys.argv) > 2 else os.path.join(src, "PLCopenXML")
    os.makedirs(dst, exist_ok=True)

    files = sorted(glob.glob(os.path.join(src, "*.st")))
    all_dt, all_po = [], []
    for f in files:
        out, n1, n2 = convert_file(f, dst)
        print("%-32s → %-40s  数据类型 %d，POU %d" % (os.path.basename(f), os.path.basename(out), n1, n2))

    # 合并版
    merged_dt, merged_po = [], []
    for f in files:
        text = open(f, encoding="utf-8-sig").read()
        for kind, blk, prefix in split_blocks(text):
            if kind == "type":
                x = parse_struct(blk)
                if x:
                    merged_dt.append(x)
            elif kind == "fb":
                x = parse_pou(blk, "fb", prefix)
                if x:
                    merged_po.append(x)
            elif kind in ("prog", "code"):
                pass   # 合并版只含类型和 FB
    xml = build_xml(merged_dt, merged_po, "案例_全部")
    out = os.path.join(dst, "00_全部_数据类型与功能块.xml")
    open(out, "w", encoding="utf-8").write(xml)
    print()
    print("合并版：%s（数据类型 %d，POU %d）" % (os.path.basename(out), len(merged_dt), len(merged_po)))


if __name__ == "__main__":
    main()
