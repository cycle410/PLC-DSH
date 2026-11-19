# -*- coding: utf-8 -*-
"""
把案例里的 .st 文件转成 Sysmac Studio 认可的 IEC 61131-10 XML

格式来源：D:\\OMRON\\Sysmac Studio\\Sample\\IEC 61131-10 XML\\Controller\\Sample.xml
并做法：用官方 XSD 校验
"""
import os, re, sys, glob, json
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from st2plcopen import split_blocks

NS = "www.iec.ch/public/TC65SC65BWG7TF10"
SMC = "https://www.ia.omron.com/Smc"
SMCXSD = "IEC61131_10_Ed1_0_SmcExt1_0_Spc1_0.xsd"

SRC = "."
DST = os.path.join(SRC, "PLCopenXML")

SEC2TAG = {
    "VAR_INPUT": ("Parameters", "InputVars"),
    "VAR_OUTPUT": ("Parameters", "OutputVars"),
    "VAR_IN_OUT": ("Parameters", "InoutVars"),
    "VAR": ("Vars", None),
    "VAR_TEMP": ("Vars", None),
}


def strip_cmt(s):
    i = s.find("//")
    return (s[:i], s[i + 2:].strip()) if i >= 0 else (s, "")


def doc_xml(cmt):
    return ('<Documentation xsi:type="SimpleText">%s</Documentation>' % escape(cmt)) if cmt else ""


def type_xml(t):
    return "<Type><TypeName>%s</TypeName></Type>" % escape(t.strip())


def var_xml(name, typ, init, cmt, order=None):
    o = (' orderWithinParamSet="%d"' % order) if order is not None else ""
    s = '<Variable name="%s"%s>' % (escape(name), o)
    s += doc_xml(cmt)
    s += type_xml(typ)
    if init:
        s += '<InitialValue><SimpleValue value="%s"/></InitialValue>' % escape(init)
    s += "</Variable>"
    return s


def parse_members(block):
    """TYPE X : STRUCT ... END_STRUCT"""
    m = re.search(r"STRUCT(.*?)END_STRUCT", block, re.S | re.I)
    if not m:
        return []
    out = []
    for line in m.group(1).splitlines():
        core, cmt = strip_cmt(line)
        core = core.strip().rstrip(";")
        mm = re.match(r"^([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*:\s*(.+)$", core)
        if not mm:
            continue
        typ, init = mm.group(2).strip(), ""
        if ":=" in typ:
            typ, init = typ.split(":=", 1)
        out.append((mm.group(1), typ.strip(), init.strip(), cmt))
    return out


def parse_sections(block):
    """返回 (in/out/inout/local 列表, 正文)"""
    m = re.search(r"(FUNCTION_BLOCK|PROGRAM)\s+(\w+)", block, re.I)
    rest = block[m.end():]
    em = re.search(r"END_(?:FUNCTION_BLOCK|PROGRAM)", rest, re.I)
    rest = rest[:em.start()] if em else rest

    secs = {"VAR_INPUT": [], "VAR_OUTPUT": [], "VAR_IN_OUT": [], "VAR": []}
    body_start = 0
    for sm in re.finditer(r"\b(VAR_INPUT|VAR_OUTPUT|VAR_IN_OUT|VAR_TEMP|VAR)\b", rest):
        e = re.search(r"\bEND_VAR\b", rest[sm.start():])
        if not e:
            continue
        inner = rest[sm.start() + len(sm.group(1)): sm.start() + e.start()]
        key = "VAR" if sm.group(1).upper() in ("VAR", "VAR_TEMP") else sm.group(1).upper()
        for line in inner.splitlines():
            core, cmt = strip_cmt(line)
            core = core.strip().rstrip(";")
            mm = re.match(r"^([A-Za-z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*:\s*(.+)$", core)
            if not mm:
                continue
            typ, init = mm.group(2).strip(), ""
            if ":=" in typ:
                typ, init = typ.split(":=", 1)
            secs[key].append((mm.group(1), typ.strip(), init.strip(), cmt))
        body_start = sm.start() + e.end()
    return secs, rest[body_start:].strip()


def fb_xml(name, secs, body, doc=""):
    s = '<FunctionBlock name="%s">' % escape(name)
    s += doc_xml(doc)
    s += "<Parameters>"
    order = 0
    for tag in ("InputVars", "OutputVars", "InoutVars"):
        key = {"InputVars": "VAR_INPUT", "OutputVars": "VAR_OUTPUT", "InoutVars": "VAR_IN_OUT"}[tag]
        items = secs.get(key) or []
        s += "<%s>" % tag
        for n, t, iv, cm in items:
            s += var_xml(n, t, iv, cm, order)
            order += 1
        s += "</%s>" % tag
    s += "</Parameters>"
    loc = secs.get("VAR") or []
    if loc:
        s += '<Vars accessSpecifier="private">'
        for n, t, iv, cm in loc:
            s += var_xml(n, t, iv, cm)
        s += "</Vars>"
    s += '<MainBody><BodyContent xsi:type="ST"><ST>%s</ST></BodyContent></MainBody>' % escape(body)
    s += "</FunctionBlock>"
    return s


def prog_xml(name, secs, body, doc=""):
    s = '<Program name="%s">' % escape(name)
    s += doc_xml(doc)
    loc = secs.get("VAR") or []
    if loc:
        s += '<Vars accessSpecifier="private">'
        for n, t, iv, cm in loc:
            s += var_xml(n, t, iv, cm)
        s += "</Vars>"
    s += '<MainBody><BodyContent xsi:type="ST"><ST>%s</ST></BodyContent></MainBody>' % escape(body)
    s += "</Program>"
    return s


def build(name, dts, pous):
    return (
        '<?xml version="1.0"?>\n'
        '<Project xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"\n'
        '         xmlns:smcext="%s"\n'
        '         xsi:schemaLocation="%s %s"\n'
        '         schemaVersion="1"\n'
        '         xmlns="%s">\n'
        '  <FileHeader companyName="AgentPLC" productName="ST Framework" productVersion="1.0.0.0" />\n'
        '  <ContentHeader name="%s" creationDateTime="2026-11-13T10:00:00">\n'
        '    <AddDataInfo>\n'
        '      <Info name="%s %s" vendor="%s" />\n'
        '    </AddDataInfo>\n'
        '  </ContentHeader>\n'
        '  <Types>\n'
        '    <GlobalNamespace>\n'
        '%s\n'
        '%s\n'
        '    </GlobalNamespace>\n'
        '  </Types>\n'
        '  <Instances>\n'
        '  </Instances>\n'
        '</Project>\n'
    ) % (SMC, SMC, SMCXSD, NS, escape(name), SMC, SMCXSD, SMC, dts, pous)


def emit(blocks, name, only_fb=False, prog_name=None):
    dts, pous = [], []
    for kind, blk, prefix in blocks:
        if kind == "type":
            nm = re.search(r"TYPE\s+(\w+)", blk, re.I).group(1)
            members = parse_members(blk)
            s = '<DataTypeDecl name="%s">' % escape(nm)
            s += "<UserDefinedTypeSpec xsi:type=\"StructTypeSpec\">"
            for n, t, iv, cm in members:
                s += '<Member name="%s">' % escape(n)
                s += doc_xml(cm)
                s += type_xml(t)
                if iv:
                    s += '<InitialValue><SimpleValue value="%s"/></InitialValue>' % escape(iv)
                s += "</Member>"
            s += "</UserDefinedTypeSpec></DataTypeDecl>"
            dts.append(s)
        elif kind in ("fb", "prog"):
            m = re.search(r"(FUNCTION_BLOCK|PROGRAM)\s+(\w+)", blk, re.I)
            nm = m.group(2)
            secs, body = parse_sections(blk)
            if prefix:
                body = prefix + "\n\n" + body
            if kind == "fb":
                pous.append(fb_xml(nm, secs, body))
            elif not only_fb:
                pous.append(prog_xml(nm, secs, body))
        elif kind == "code":
            if only_fb or not prog_name:
                continue
            code = blk.strip()
            if not code:
                continue
            pous.append(prog_xml(prog_name, {}, code))
    return build(name, "\n".join(dts), "\n".join(pous))


def main():
    files = sorted(glob.glob(os.path.join(SRC, "*.st")))
    # 合并版（只含类型 + FB）
    all_blocks = []
    for f in files:
        all_blocks += split_blocks(open(f, encoding="utf-8-sig").read())
    out = os.path.join(DST, "00_全部_数据类型与功能块.xml")
    open(out, "w", encoding="utf-8").write(emit(all_blocks, "案例_全部", only_fb=True))
    print("合并版 →", os.path.basename(out))

    for f in files:
        base = os.path.splitext(os.path.basename(f))[0]
        blocks = split_blocks(open(f, encoding="utf-8-sig").read())
        pname = base.split("_")[-1]
        xml = emit(blocks, base, prog_name=pname)
        out = os.path.join(DST, base + ".xml")
        open(out, "w", encoding="utf-8").write(xml)
        print("  %-30s → %s" % (os.path.basename(f), os.path.basename(out)))


if __name__ == "__main__":
    main()
