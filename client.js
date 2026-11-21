window.__ModuleLoader__.load({
  id: '@local/dsh-agentplc',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'agentplc'

    const DICT = {
      zh: {
        'nav.label': 'PLC 工程台',
        title: 'PLC 工程台',
        subtitle: '欧姆龙 Sysmac Studio · 西门子 TIA Portal',
        refresh: '刷新',
        loading: '加载中…',
        retry: '重试',
        close: '关闭',
        'status.ready': '已就绪',
        'status.loading': '正在读取',
        'status.checking': '正在检测',
        'status.error': '读取失败',
        'card.checking': '正在检测…',
        'card.sysmac': '欧姆龙 Sysmac Studio',
        'card.tia': '博途 TIA Openness',
        'card.st': 'ST → Sysmac XML',
        'card.installed': '已安装',
        'card.notInstalled': '未安装',
        'card.offline': '离线解析 .smc2 可用',
        'card.opennessReady': 'Openness 就绪',
        'card.opennessMissing': '未找到 Openness 程序集',
        'card.userGroup': '用户组：{state}',
        'card.member': '已在 Openness 组',
        'card.notMember': '不在 Openness 组',
        'card.unknown': '未知',
        'card.converterReady': '转换器就绪（{python}）',
        'card.converterMissing': '未找到 Python 3',
        'card.converterHint': '把 .st 转成 Sysmac 可导入的 IEC 61131-10 XML',
        'list.title': '工程',
        'list.search': '筛选名称或路径',
        'list.empty': '未发现工程',
        'list.emptyFiltered': '没有匹配的工程',
        'list.generatedAt': '扫描于 {time}',
        'list.emptyHint': '把 .smc2、TIA 工程目录或 .st 源文件放到扫描目录下，然后刷新。',
        'list.emptyNoRoots': '还没有扫描目录：点上方「添加文件夹」输入路径，或用「浏览…」选一个工程目录。',
        'list.roots': '扫描 {n} 个目录',
        'list.truncated': '扫描达到上限，结果可能不完整',
        'list.counts': '{sysmac} 个 .smc2 · {tia} 个博途 · {st} 个 .st',
        'detail.emptyTitle': '选择一个工程',
        'detail.errorTitle': '读取失败',
        'detail.emptyBody': '左侧选择 .smc2 或博途工程可查看控制器、变量表、ST 程序和 IO 清单；选择 .st 源文件可以直接生成 Sysmac 可导入的 XML。',
        'detail.emptyHint': '编程任务直接在对话里说：先描述要求，Agent 会读工程（POU、变量、IO 清单）→ 给你方案，你确认后才写 ST/SCL 并跑编译，按真实错误修。IO 分配和任务设置仍由你在工程里做。',
        'detail.rootsConfig': '扫描目录由 agentplc.projectRoots 配置决定（profile 的 cordis.patch.yml）。',
        'tab.overview': '概览',
        'tab.variables': '变量',
        'tab.programs': '程序',
        'meta.controller': '控制器',
        'meta.compiler': '编译器',
        'meta.pous': 'POU',
        'meta.variables': '变量',
        'meta.tables': '变量表',
        'meta.tasks': '任务',
        'meta.size': '大小',
        'meta.modified': '修改时间',
        'meta.entries': '归档条目',
        'meta.guid': '工程 GUID',
        'meta.language': '语言',
        'meta.type': '类型',
        'meta.lines': '正文',
        'meta.unknown': '未知',
        'overview.tasks': '任务',
        'overview.tables': '变量表',
        'overview.notes': '解析提示',
        'overview.noNotes': '解析过程中没有发现异常。',
        'overview.pous': '程序组织单元',
        'variables.search': '搜索变量名 / 类型 / 地址 / 注释',
        'variables.count': '共 {total} 条，显示 {shown} 条',
        'variables.sampleNote': '共 {total} 条；显示样本前 {sample} 条中的 {shown} 条，完整表请下载 CSV',
        'variables.empty': '没有匹配的变量',
        'verify.title': '静态校验',
        'verify.run': '运行校验',
        'verify.running': '校验中…',
        'verify.clean': '静态校验通过：未发现未声明变量、重复定义、地址冲突或块不配平。',
        'verify.summary': '{errors} 个错误 · {warnings} 个警告',
        'verify.more': '还有 {n} 条未显示',
        'roots.add': '添加文件夹',
        'roots.browse': '浏览…',
        'roots.addFailed': '添加失败：{error}',
        'roots.removeFailed': '移除失败：{error}',
        'roots.pickUnavailable': '读不到所选文件夹的路径（当前外壳不支持），请把完整路径粘贴到输入框再点「添加文件夹」。',
        'roots.remove': '移除该扫描目录',
        'roots.list': '扫描目录 ({n})',
        'roots.deleteSelected': '删除选中',
        'roots.placeholder': '输入或粘贴文件夹路径，如 D:\\Projects',
        'create.title': '新建工程',
        'create.example': '内置示例',
        'create.template': '模板工程',
        'create.name': '工程名',
        'create.output': '输出路径',
        'create.outputHint': '留空则写到模板同目录；用内置示例时写到「文档」目录',
        'create.variablesMode': '全局变量表',
        'create.pouName': '新增 POU 名称（可选）',
        'create.pouBody': 'ST 正文',
        'create.compile': '生成后原厂编译（需 UAC）',
        'create.overwrite': '覆盖同名文件',
        'create.submit': '生成',
        'create.cancel': '取消',
        'create.running': '生成中…',
        'create.success': '已生成：{path}',
        'create.verify': '静态校验：{errors} 个错误 · {warnings} 个警告',
        'create.compileResult': '原厂编译：{errors} 个错误 · {warnings} 个警告',
        'create.newPous': '新增 POU：{names}',
        'create.backup': '原文件已备份到 {path}',
        'create.outsideRoots': '工程已生成，但它不在扫描目录里：把所在文件夹加入扫描目录后，才能在面板左侧看到并打开。',
        'create.error': '生成失败：{error}',
        'create.modeReplace': '替换',
        'create.modeMerge': '合并',
        'create.modeKeep': '保留',
        'variables.download': '下载变量 CSV',
        'variables.name': '名称',
        'variables.type': '数据类型',
        'variables.address': '地址',
        'variables.scope': '作用域',
        'programs.hint': '选择 POU 查看程序正文',
        'programs.empty': '该工程没有可读的 POU',
        'programs.noRungs': '该段没有可读梯级',
        'programs.noTasks': '没有任务信息',
        'programs.noTables': '没有变量表',
        'programs.truncated': '只显示前 {shown} 级，共 {total} 级',
        'programs.st': 'ST 源码',
        'programs.ladder': '梯形图',
        'programs.mixed': '混合',
        'programs.sections': '{n} 段',
        'programs.rungs': '{n} 级',
        'programs.lines': '{n} 行',
        'st.download': '生成并下载 Sysmac XML',
        'st.downloadPlcopen': '下载 PLCopen XML',
        'st.formatHint': 'Sysmac 导入用 IEC 61131-10；PLCopen TC6 2.01 是厂商中立的通用 XML，两者都由同一份 .st 生成。',
        'st.converting': '正在生成…',
        'st.failed': '转换失败：{error}',
        'st.blocks': '识别到 {n} 个块',
        'st.blocksLabel': '块',
        'st.sourceTruncated': '源码仅预览前 {n} 字符',
        'st.hint': '输出为 IEC 61131-10 XML，可直接在 Sysmac Studio 中导入。',
        'tia.hint': '博途工程由博途自身管理，需要通过 TIA Openness 读取或修改。',
        'tia.plan': '复制 Openness 指令',
        'tia.readiness': 'Openness 状态：{text}',
        'tia.noteLocal': '博途工程由博途自身管理；读取或修改需要 TIA Openness。',
        'tia.readDevices': '读取设备与块',
        'tia.reading': '正在通过 Openness 读取…',
        'tia.device': '设备',
        'tia.blocks': '块',
        'tia.types': '数据类型',
        'tia.openHint': '首次读取可能弹出「Openness 访问」提示，选「全部确定」即可。',
        'tia.interfaces': '块接口',
        'tia.compile': '编译 PLC',
        'tia.compiling': '编译中…',
        'tia.compileResult': '编译结果：{state}，{errors} 个错误 / {warnings} 个警告',
        'tia.deleteBlock': '删除块',
        'tia.deleteConfirm': '确定删除块「{name}」吗？删除后会重新编译。',
        'tia.deleted': '已删除 {name}，已重新编译',
        'tia.readAllInterfaces': '读取前 20 个块',
        'tia.chooseBlock': '选一个块读接口…',
        'tia.interfacesHint': '读取会后台启动博途并导出块 XML（约 40 秒）；有编译错误的块 TIA 拒绝导出。',
        'tia.noMembers': '这个块没有接口成员',
        'io.title': 'IO 清单',
        'io.direction': '方向',
        'io.read': '读取 IO 清单',
        'io.reading': '正在读取…',
        'io.reload': '刷新清单',
        'io.note': '只读：把工程里已有的变量按输入 / 输出 / IO 区 / 存储 / 内部归类；不修改工程，地址与任务仍由你在工程里分配。',
        'io.noteTia': 'TIA 工程通过 Openness 读取：会后台打开博途，约 40 秒；只读，不修改工程。',
        'io.search': '按名称 / 地址 / 注释筛选',
        'io.empty': '工程里没有变量',
        'io.noAddress': '还没有分配地址的变量；IO 分配由你在工程里完成。',
        'io.all': '全部',
        'io.input': '输入',
        'io.output': '输出',
        'io.io': 'IO 区',
        'io.memory': '存储',
        'io.internal': '内部',
        'io.name': '名称',
        'io.address': '地址',
        'io.type': '类型',
        'io.comment': '注释',
        'io.table': '变量表',
        'io.csv': '导出 IO CSV',
        'io.rows': '{shown} / {total} 行',
        'copy': '复制指令',
        'copied': '已复制',
        'copyFailed': '复制失败，请手动选中',
        'copy.sysmac': '用 plc_sysmac 读取工程「{path}」：先给控制器、POU 和变量表概览，再用 plc_io 看已有地址。改程序时把 ST 正文给我，用 create 生成工程并加 compile:true 跑原厂编译；全局变量只放普通类型，TON 放程序内 VAR，程序里用到的全局变量要写 VAR_EXTERNAL。',
        'copy.tia': '用 plc_tia 打开博途工程「{path}」：先用 action=plan、operation=list 生成并审查命令，确认后用 action=run、operation=list 列出设备和 PLC 块；要读标签表就用 operation=listTags。',
        'download.failed': '下载失败：{error}',
        'download.busy': '正在下载…',
        'handoff.title': '交给 Agent',
        'handoff.show': '查看提示词',
        'handoff.hide': '收起',
        'handoff.copy': '复制提示词',
        'handoff.hint': '把提示词粘贴到对话里发送：Agent 会先读这个工程、给出方案，等你确认后再写程序和编译。',
        'copy.st': '用 plc_st 把「{path}」转成 Sysmac 可导入的 IEC 61131-10 XML；如果转换失败，把完整错误给我，并说明怎么改。',
        'error.prefix': '读取失败：{error}',
      },
      en: {
        'nav.label': 'PLC workspace',
        title: 'PLC workspace',
        subtitle: 'OMRON Sysmac Studio · Siemens TIA Portal',
        refresh: 'Refresh',
        loading: 'Loading…',
        retry: 'Retry',
        close: 'Close',
        'status.ready': 'Ready',
        'status.loading': 'Reading',
        'status.checking': 'Checking',
        'status.error': 'Failed',
        'card.checking': 'Checking…',
        'card.sysmac': 'OMRON Sysmac Studio',
        'card.tia': 'TIA Portal Openness',
        'card.st': 'ST → Sysmac XML',
        'card.installed': 'Installed',
        'card.notInstalled': 'Not installed',
        'card.offline': 'Offline .smc2 reading works',
        'card.opennessReady': 'Openness ready',
        'card.opennessMissing': 'Openness assembly not found',
        'card.userGroup': 'User group: {state}',
        'card.member': 'member',
        'card.notMember': 'not a member',
        'card.unknown': 'unknown',
        'card.converterReady': 'Converter ready ({python})',
        'card.converterMissing': 'Python 3 not found',
        'card.converterHint': 'Turns .st sources into Sysmac-importable IEC 61131-10 XML',
        'list.title': 'Projects',
        'list.search': 'Filter by name or path',
        'list.empty': 'No projects found',
        'list.emptyFiltered': 'No project matches this filter',
        'list.generatedAt': 'Scanned {time}',
        'list.emptyHint': 'Place .smc2, TIA project folders, or .st sources under a scanned folder, then refresh.',
        'list.emptyNoRoots': 'No scanned folder yet: use "Add folder" above or pick a project folder with "Browse…".',
        'list.roots': '{n} scanned folders',
        'list.truncated': 'Scan hit its limit; results may be incomplete',
        'list.counts': '{sysmac} .smc2 · {tia} TIA · {st} .st',
        'detail.emptyTitle': 'Select a project',
        'detail.errorTitle': 'Read failed',
        'detail.emptyBody': 'Pick a .smc2 or TIA project to read its controller, variables, ST programs and IO inventory; pick a .st source to build the Sysmac-importable XML.',
        'detail.emptyHint': 'Start a programming task in the conversation: describe the requirement; the agent reads the project (POUs, variables, IO inventory), proposes an approach, and only after your approval writes the ST/SCL, compiles it and fixes the real errors. IO and task assignment stay with you.',
        'detail.rootsConfig': 'Scanned folders come from the agentplc.projectRoots setting in the profile cordis.patch.yml.',
        'tab.overview': 'Overview',
        'tab.variables': 'Variables',
        'tab.programs': 'Programs',
        'meta.controller': 'Controller',
        'meta.compiler': 'Compiler',
        'meta.pous': 'POUs',
        'meta.variables': 'Variables',
        'meta.tables': 'Tables',
        'meta.tasks': 'Tasks',
        'meta.size': 'Size',
        'meta.modified': 'Modified',
        'meta.entries': 'Entries',
        'meta.guid': 'Project GUID',
        'meta.language': 'Language',
        'meta.type': 'Type',
        'meta.lines': 'Body',
        'meta.unknown': 'unknown',
        'overview.tasks': 'Tasks',
        'overview.tables': 'Variable tables',
        'overview.notes': 'Parse notes',
        'overview.noNotes': 'No anomalies while reading this project.',
        'overview.pous': 'Program organization units',
        'variables.search': 'Search name / type / address / comment',
        'variables.count': '{total} rows, showing {shown}',
        'variables.sampleNote': '{total} rows; showing {shown} of the first {sample} sampled rows — download the CSV for the complete table',
        'variables.empty': 'No matching variables',
        'verify.title': 'Static check',
        'verify.run': 'Run check',
        'verify.running': 'Checking…',
        'verify.clean': 'No undeclared names, duplicate variables, address conflicts or unbalanced blocks were found.',
        'verify.summary': '{errors} error(s) · {warnings} warning(s)',
        'verify.more': '{n} more not shown',
        'roots.add': 'Add folder',
        'roots.browse': 'Browse…',
        'roots.addFailed': 'Could not add the folder: {error}',
        'roots.removeFailed': 'Could not remove the folder: {error}',
        'roots.pickUnavailable': 'This shell does not expose the selected folder path; paste the full path into the box and press "Add folder".',
        'roots.remove': 'Remove this root',
        'roots.list': 'Scanned folders ({n})',
        'roots.deleteSelected': 'Delete selected',
        'roots.placeholder': 'Type or paste a folder path, e.g. D:\\Projects',
        'create.title': 'New project',
        'create.example': 'Bundled example',
        'create.template': 'Template project',
        'create.name': 'Project name',
        'create.output': 'Output path',
        'create.outputHint': 'Leave empty to write next to the template; the bundled example writes to Documents',
        'create.variablesMode': 'Global variable table',
        'create.pouName': 'New POU name (optional)',
        'create.pouBody': 'ST body',
        'create.compile': 'Run vendor compile after creating (needs UAC)',
        'create.overwrite': 'Overwrite an existing file',
        'create.submit': 'Create',
        'create.cancel': 'Cancel',
        'create.running': 'Creating…',
        'create.success': 'Created: {path}',
        'create.verify': 'Static check: {errors} error(s) · {warnings} warning(s)',
        'create.compileResult': 'Vendor compile: {errors} error(s) · {warnings} warning(s)',
        'create.newPous': 'New POUs: {names}',
        'create.backup': 'Previous file backed up to {path}',
        'create.outsideRoots': 'The project is built, but it is outside the scan roots. Add its folder as a scan root to see and open it in this panel.',
        'create.error': 'Create failed: {error}',
        'create.modeReplace': 'Replace',
        'create.modeMerge': 'Merge',
        'create.modeKeep': 'Keep',
        'variables.download': 'Download variable CSV',
        'variables.name': 'Name',
        'variables.type': 'Data type',
        'variables.address': 'Address',
        'variables.scope': 'Scope',
        'programs.hint': 'Select a POU to read its body',
        'programs.empty': 'This project has no readable POU',
        'programs.noRungs': 'This section has no readable rungs',
        'programs.noTasks': 'No task information',
        'programs.noTables': 'No variable tables',
        'programs.truncated': 'Showing the first {shown} of {total} rungs',
        'programs.st': 'ST source',
        'programs.ladder': 'Ladder',
        'programs.mixed': 'Mixed',
        'programs.sections': '{n} sections',
        'programs.rungs': '{n} rungs',
        'programs.lines': '{n} lines',
        'st.download': 'Build and download Sysmac XML',
        'st.downloadPlcopen': 'Download PLCopen XML',
        'st.formatHint': 'IEC 61131-10 is what Sysmac Studio imports; PLCopen TC6 2.01 is the vendor-neutral XML. Both come from the same .st source.',
        'st.converting': 'Building…',
        'st.failed': 'Conversion failed: {error}',
        'st.blocks': '{n} blocks detected',
        'st.blocksLabel': 'blocks',
        'st.sourceTruncated': 'Showing the first {n} characters of the source',
        'st.hint': 'The output is IEC 61131-10 XML and imports directly in Sysmac Studio.',
        'tia.hint': 'TIA Portal projects are owned by TIA Portal; read or change them through TIA Openness.',
        'tia.plan': 'Copy Openness command',
        'tia.readiness': 'Openness state: {text}',
        'tia.noteLocal': 'TIA Portal owns this project; reading or changing it requires TIA Openness.',
        'tia.readDevices': 'Read devices and blocks',
        'tia.reading': 'Reading through Openness…',
        'tia.device': 'Device',
        'tia.blocks': 'blocks',
        'tia.types': 'types',
        'tia.openHint': 'The first read may show an "Openness access" prompt; choose "Allow all".',
        'tia.interfaces': 'Block interfaces',
        'tia.compile': 'Compile PLC',
        'tia.compiling': 'Compiling…',
        'tia.compileResult': 'Compile result: {state}, {errors} error(s) / {warnings} warning(s)',
        'tia.deleteBlock': 'Delete block',
        'tia.deleteConfirm': 'Delete block "{name}"? It will recompile after deletion.',
        'tia.deleted': 'Deleted {name} and recompiled',
        'tia.readAllInterfaces': 'Read first 20 blocks',
        'tia.chooseBlock': 'Pick a block to read…',
        'tia.interfacesHint': 'Reading starts TIA in the background and exports block XML (~40 s); blocks with compile errors cannot be exported.',
        'tia.noMembers': 'This block has no interface members',
        'io.title': 'IO inventory',
        'io.direction': 'Direction',
        'io.read': 'Load IO inventory',
        'io.reading': 'Reading…',
        'io.reload': 'Reload inventory',
        'io.note': 'Read-only: groups the variables that already exist into input / output / IO area / memory / internal. Nothing is changed; addresses and tasks stay with you.',
        'io.noteTia': 'TIA projects are read through Openness: TIA opens in the background, about 40 seconds. Read-only.',
        'io.search': 'Filter by name / address / comment',
        'io.empty': 'This project has no variables',
        'io.noAddress': 'No address is assigned yet; IO assignment stays with you in the project.',
        'io.all': 'All',
        'io.input': 'Input',
        'io.output': 'Output',
        'io.io': 'IO area',
        'io.memory': 'Memory',
        'io.internal': 'Internal',
        'io.name': 'Name',
        'io.address': 'Address',
        'io.type': 'Type',
        'io.comment': 'Comment',
        'io.table': 'Table',
        'io.csv': 'Export IO CSV',
        'io.rows': '{shown} / {total} rows',
        'copy': 'Copy prompt',
        'copied': 'Copied',
        'copyFailed': 'Copy failed; select the text manually',
        'copy.sysmac': 'Use plc_sysmac to read the project "{path}": summarise the controller, POUs and variable tables first, then plc_io for the existing addresses. When the program must change, give me the ST body and use create with compile:true for a vendor compile; globals hold ordinary types only, TON instances go in the POU VAR, and every global a program uses needs a VAR_EXTERNAL mirror.',
        'copy.tia': 'Use plc_tia on the TIA project "{path}": first action=plan, operation=list to generate and review the command, then action=run, operation=list to list devices and PLC blocks; operation=listTags reads the tag tables.',
        'download.failed': 'Download failed: {error}',
        'download.busy': 'Downloading…',
        'handoff.title': 'Hand to the agent',
        'handoff.show': 'Show prompt',
        'handoff.hide': 'Hide',
        'handoff.copy': 'Copy prompt',
        'handoff.hint': 'Paste the prompt into the conversation: the agent reads this project, proposes an approach, and only after you approve writes and compiles the program.',
        'copy.st': 'Use plc_st to convert "{path}" to Sysmac-importable IEC 61131-10 XML; if conversion fails, show me the full converter error and how to fix it.',
        'error.prefix': 'Read failed: {error}',
      },
    }

    const CSS = `
.ap-root {
  --ap-mono: ui-monospace, "Cascadia Code", "JetBrains Mono", Consolas, monospace;
  --ap-radius: 12px;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
}
.ap-root *, .ap-root *::before, .ap-root *::after { box-sizing: border-box; }
.ap-root button { font-family: inherit; }

/* ---------------------------------------------------------------- header */
.ap-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 24px 14px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-brand-primary) 7%, transparent), transparent);
}
.ap-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.ap-brand-mark {
  width: 38px; height: 38px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: 11px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.ap-title { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ap-title-main { font-size: 17px; font-weight: 650; letter-spacing: 0.01em; }
.ap-title-sub { color: var(--dsw-alias-label-secondary); font-size: 11.5px; }
.ap-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.ap-pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 10px; border-radius: 999px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-secondary);
  font-size: 11px; white-space: nowrap;
}
.ap-icon-btn {
  width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
  cursor: pointer; transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}
.ap-icon-btn:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); border-color: var(--dsw-alias-border-l2); }

/* dots */
.ap-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--dsw-alias-state-idle-primary); flex-shrink: 0; }
.ap-dot.ok { background: var(--dsw-alias-state-success-primary); }
.ap-dot.warn { background: var(--dsw-alias-state-warn-primary); }
.ap-dot.error { background: var(--dsw-alias-state-error-primary); }

/* ------------------------------------------------------------ status strip */
.ap-status {
  display: flex; align-items: stretch; flex-wrap: wrap;
  margin: 0 24px 16px;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--ap-radius);
  background: var(--dsw-alias-bg-layer-1);
  overflow: hidden;
}
.ap-status-item { display: flex; align-items: center; gap: 9px; padding: 11px 16px; flex: 1 1 200px; min-width: 0; }
.ap-status-item + .ap-status-item { border-left: 1px solid var(--dsw-alias-border-l1); }
.ap-status-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ap-status-label { color: var(--dsw-alias-label-secondary); font-size: 10.5px; letter-spacing: 0.03em; text-transform: uppercase; }
.ap-status-value { font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-status-counts { display: flex; align-items: center; gap: 16px; padding: 11px 16px; border-left: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); }
.ap-count { display: inline-flex; align-items: baseline; gap: 4px; font-size: 11px; color: var(--dsw-alias-label-secondary); white-space: nowrap; }
.ap-count b { font-size: 14px; font-weight: 650; color: var(--dsw-alias-label-primary); }

/* ---------------------------------------------------------------- layout */
.ap-body {
  display: grid; grid-template-columns: 316px minmax(0, 1fr);
  gap: 16px; flex: 1; min-height: 0; padding: 0 24px 20px;
}
.ap-list, .ap-detail {
  min-height: 0;
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: var(--ap-radius);
  background: var(--dsw-alias-bg-layer-1);
}
.ap-list { display: flex; flex-direction: column; overflow: hidden; }
.ap-list-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 14px 16px 8px; }
.ap-list-title { font-size: 11px; font-weight: 650; letter-spacing: 0.07em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
.ap-list-count { font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.ap-search-wrap { padding: 0 12px 10px; }
.ap-search {
  width: 100%; border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  padding: 7px 10px; font-size: 12px; font-family: inherit;
  transition: border-color 120ms ease;
}
.ap-search::placeholder { color: var(--dsw-alias-label-secondary); }
.ap-search:focus { outline: none; border-color: var(--dsw-alias-brand-primary); }
.ap-search-wrap + .ap-projects { padding-top: 2px; }
.ap-projects { flex: 1; overflow: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 2px; }
.ap-project {
  display: flex; flex-direction: column; gap: 3px;
  padding: 8px 10px; border-radius: 8px;
  border: 1px solid transparent; background: transparent;
  text-align: left; cursor: pointer; color: inherit; font-family: inherit;
  transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
.ap-project:hover { background: var(--dsw-alias-bg-layer-2); }
.ap-project.selected {
  background: var(--dsw-alias-bg-layer-2);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, var(--dsw-alias-bg-layer-1));
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 35%, transparent);
  box-shadow: inset 2px 0 0 var(--dsw-alias-brand-primary);
}
.ap-project-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.ap-project-name { font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-project-meta { color: var(--dsw-alias-label-secondary); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-tag {
  flex-shrink: 0; font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em;
  padding: 1px 6px; border-radius: 5px; border: 1px solid var(--dsw-alias-border-l2);
  color: var(--dsw-alias-label-secondary); text-transform: uppercase;
}
.ap-tag.sysmac {
  color: var(--dsw-alias-brand-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
}
.ap-tag.st {
  color: var(--dsw-alias-state-success-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);
}
.ap-tag.tia {
  color: var(--dsw-alias-state-warn-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 12%, transparent);
}
.ap-list-foot {
  color: var(--dsw-alias-label-secondary); font-size: 10.5px;
  padding: 8px 16px 10px; border-top: 1px solid var(--dsw-alias-border-l1);
  line-height: 1.55; display: flex; flex-direction: column; gap: 1px;
}
.ap-list-note { display: flex; flex-direction: column; gap: 6px; padding: 10px 8px; }
.ap-skeleton { height: 46px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2); }
.ap-skeleton + .ap-skeleton { margin-top: 4px; }
.ap-skeleton.line { height: 12px; border-radius: 6px; }

/* ---------------------------------------------------------------- detail */
.ap-detail { overflow: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
.ap-detail-head { display: flex; flex-direction: column; gap: 7px; }
.ap-detail-title { display: flex; align-items: center; gap: 9px; min-width: 0; }
.ap-detail-name { font-size: 16px; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-path {
  align-self: flex-start; max-width: 100%;
  color: var(--dsw-alias-label-secondary); font-family: var(--ap-mono); font-size: 10.5px;
  background: var(--dsw-alias-bg-layer-2); border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 6px; padding: 3px 7px; overflow-wrap: anywhere;
}
.ap-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.ap-download { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.ap-btn {
  appearance: none; display: inline-flex; align-items: center; gap: 6px;
  border: 1px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary); border-radius: 8px; padding: 6px 12px;
  font-size: 12px; font-weight: 500; cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.ap-btn:hover { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.ap-btn:disabled { opacity: 0.55; cursor: default; }
.ap-btn.primary {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 60%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.ap-btn.primary:hover { background: color-mix(in srgb, var(--dsw-alias-brand-primary) 22%, transparent); }

.ap-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(118px, 1fr)); gap: 8px; }
.ap-cell {
  display: flex; flex-direction: column; gap: 2px; min-width: 0;
  padding: 9px 11px; border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2);
}
.ap-cell-label { color: var(--dsw-alias-label-secondary); font-size: 10px; letter-spacing: 0.04em; text-transform: uppercase; }
.ap-cell-value { font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.ap-tabs {
  display: inline-flex; gap: 2px; align-self: flex-start; padding: 3px;
  border-radius: 9px; background: var(--dsw-alias-bg-layer-2);
  border: 1px solid var(--dsw-alias-border-l1);
}
.ap-tab {
  appearance: none; border: 1px solid transparent; background: transparent;
  color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 4px 12px;
  border-radius: 7px; cursor: pointer; transition: color 120ms ease, background 120ms ease;
}
.ap-tab:hover { color: var(--dsw-alias-label-primary); }
.ap-tab.active {
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  border-color: var(--dsw-alias-border-l1); font-weight: 550;
}

.ap-section { display: flex; flex-direction: column; gap: 8px; }
.ap-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.ap-section-title { font-size: 10.5px; font-weight: 650; color: var(--dsw-alias-label-secondary); text-transform: uppercase; letter-spacing: 0.07em; }
.ap-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.ap-chip {
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px;
  padding: 2px 9px; font-size: 11.5px; color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
}
.ap-chip.filter {
  cursor: pointer; font: inherit; font-size: 11.5px; padding: 2px 9px;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
}
.ap-chip-del {
  border: 0; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1;
  padding: 0 0 0 6px; vertical-align: middle;
}
.ap-chip-del:hover { color: var(--dsw-alias-state-error-primary); }
.ap-chip-del:disabled { opacity: 0.4; cursor: default; }
.ap-chip.filter:hover { border-color: var(--dsw-alias-border-l2); color: var(--dsw-alias-label-primary); }
.ap-chip.filter.active {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, var(--dsw-alias-bg-base));
  color: var(--dsw-alias-label-primary);
}
.ap-io-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }.ap-io-counts { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.ap-io-tools { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.ap-dir {
  display: inline-block; white-space: nowrap;
  font-size: 10px; letter-spacing: 0.02em; padding: 1px 7px; border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  border: 1px solid var(--dsw-alias-border-l1);
}
.ap-dir.input, .ap-dir.output { color: var(--dsw-alias-label-primary); }
.ap-io-addr { font-family: var(--ap-mono); font-size: 10.5px; color: var(--dsw-alias-label-secondary); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-io-table-name { font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ap-io-comment { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.ap-note {
  border: 1px solid var(--dsw-alias-border-l1);
  border-left: 3px solid var(--dsw-alias-state-warn-primary);
  border-radius: 7px; padding: 8px 11px;
  color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 1.55;
  background: var(--dsw-alias-bg-layer-2);
}
.ap-issues { display: flex; flex-direction: column; gap: 4px; max-height: 30vh; overflow: auto; }
.ap-issue {
  font-family: var(--ap-mono); font-size: 11px; line-height: 1.5;
  padding: 5px 9px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  overflow-wrap: anywhere;
}
.ap-issue.error {
  color: var(--dsw-alias-state-error-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary) 40%, transparent);
}
.ap-issue.warning {
  color: var(--dsw-alias-state-warn-primary);
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary) 40%, transparent);
}
.ap-modal {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
.ap-modal-card {
  width: min(660px, 92vw); max-height: 86vh; overflow: auto;
  display: flex; flex-direction: column; gap: 10px;
  padding: 16px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.35);
}
.ap-modal-head { display: flex; align-items: center; justify-content: space-between; font-weight: 600; }
.ap-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ap-field input, .ap-field select, .ap-field textarea {
  font: inherit; font-family: var(--ap-mono); font-size: 12px;
  padding: 6px 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}
.ap-field textarea { min-height: 110px; resize: vertical; }
.ap-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
.ap-create-result {
  display: flex; flex-direction: column; gap: 4px;
  max-height: 26vh; overflow: auto;
  padding: 8px 10px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}
.ap-handoff {
  display: flex; flex-direction: column; gap: 6px;
  padding: 8px 11px; border-radius: 9px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
}
.ap-handoff-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.ap-handoff-actions { display: flex; gap: 8px; }
.ap-prompt {
  width: 100%; resize: vertical;
  font-family: var(--ap-mono); font-size: 11px; line-height: 1.55;
  padding: 8px; border-radius: 6px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
}
.ap-check { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.ap-btn.primary {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.ap-input {
  height: 28px; width: 220px; padding: 0 8px;
  border-radius: 6px; font: inherit; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}
.ap-select {
  height: 28px; max-width: 220px; padding: 0 6px;
  border-radius: 6px; font: inherit; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}
.ap-roots { display: flex; flex-wrap: wrap; gap: 6px; padding: 6px 16px 0; }
.ap-root-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 8px; border-radius: 999px; font-size: 11px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  max-width: 46%;
}
.ap-root-path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--ap-mono); }
.ap-root-del {
  border: 0; background: transparent; cursor: pointer;
  color: var(--dsw-alias-label-secondary); font-size: 13px; line-height: 1; padding: 0 2px;
}
.ap-roots-panel {
  display: flex; flex-direction: column; gap: 4px;
  width: 100%; margin-top: 6px; padding: 8px;
  border-radius: 8px; border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-2);
  max-height: 200px; overflow: auto;
}
.ap-root-item { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--dsw-alias-label-secondary); }
.ap-roots-actions { display: flex; justify-content: flex-end; margin-top: 4px; }

/* tables */
.ap-table-wrap { border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px; overflow: auto; max-height: 46vh; }
.ap-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ap-table th {
  position: sticky; top: 0; z-index: 1;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary);
  font-weight: 550; font-size: 10.5px; letter-spacing: 0.04em; text-transform: uppercase;
  text-align: left; padding: 8px 11px; border-bottom: 1px solid var(--dsw-alias-border-l1); white-space: nowrap;
}
.ap-table td { padding: 7px 11px; border-bottom: 1px solid var(--dsw-alias-border-l1); vertical-align: top; }
.ap-table tbody tr:hover { background: var(--dsw-alias-bg-layer-2); }
.ap-table tr:last-child td { border-bottom: none; }
.ap-table td.mono { font-family: var(--ap-mono); font-size: 10.5px; color: var(--dsw-alias-label-secondary); }

/* programs */
.ap-pou-list { display: flex; flex-direction: column; gap: 5px; }
.ap-pou {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 8px 11px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-base);
  cursor: pointer; color: inherit; font-family: inherit; text-align: left;
  transition: border-color 120ms ease, background 120ms ease;
}
.ap-pou:hover { border-color: var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2); }
.ap-pou.active {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 55%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, var(--dsw-alias-bg-layer-1));
}
.ap-pou-name { font-size: 12.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ap-pou-meta { color: var(--dsw-alias-label-secondary); font-size: 10.5px; flex-shrink: 0; }

/* code and rungs */
.ap-code {
  margin: 0; padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 9px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font-family: var(--ap-mono); font-size: 11.5px; line-height: 1.7;
  max-height: 48vh; overflow: auto; white-space: pre; tab-size: 4;
}
.ap-rungs {
  display: flex; flex-direction: column; gap: 5px; max-height: 48vh; overflow: auto;
  font-family: var(--ap-mono); font-size: 11.5px;
}
.ap-rung {
  display: flex; gap: 9px; padding: 7px 10px; border-radius: 8px;
  background: var(--dsw-alias-bg-base); border: 1px solid var(--dsw-alias-border-l1);
}
.ap-rung-index {
  flex-shrink: 0; align-self: flex-start;
  font-size: 10px; color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-layer-2); border-radius: 5px; padding: 1px 6px;
}
.ap-rung-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.ap-rung-st summary { cursor: pointer; color: var(--dsw-alias-label-secondary); font-size: 10px; letter-spacing: 0.05em; }
.ap-rung-st pre { margin-top: 6px; max-height: 26vh; }

/* empty and feedback */
.ap-empty-wrap { display: flex; align-items: center; justify-content: center; height: 100%; padding: 28px 20px; }
.ap-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; max-width: 460px; color: var(--dsw-alias-label-secondary); line-height: 1.6; }
.ap-empty-icon {
  width: 54px; height: 54px; margin-bottom: 4px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 15px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary) 12%, transparent);
  color: var(--dsw-alias-brand-primary);
}
.ap-empty-title { font-size: 15px; font-weight: 650; color: var(--dsw-alias-label-primary); }
.ap-empty-body { font-size: 12px; }
.ap-hint { color: var(--dsw-alias-label-secondary); font-size: 11.5px; line-height: 1.6; }
.ap-error {
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent);
  border-radius: 9px; padding: 10px 12px;
  color: var(--dsw-alias-state-error-primary); font-size: 12px;
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);
}
.ap-error-bar { margin: 0 24px 12px; }
.ap-spinner { color: var(--dsw-alias-label-secondary); font-size: 12px; padding: 12px 0; }

/* focus */
.ap-root button:focus-visible, .ap-root input:focus-visible, .ap-root a:focus-visible, .ap-root summary:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}

@media (max-width: 980px) {
  .ap-body { grid-template-columns: 270px minmax(0, 1fr); }
}
@media (max-width: 860px) {
  .ap-body { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(160px, 34%) minmax(0, 1fr); }
  .ap-list { max-height: 36vh; }
  .ap-top, .ap-status { padding-left: 16px; padding-right: 16px; }
  .ap-status { margin: 0 16px 14px; }
  .ap-body { padding: 0 16px 16px; }
  .ap-error-bar { margin: 0 16px 12px; }
  .ap-status-item { flex-basis: 100%; border-left: none; }
  .ap-status-item + .ap-status-item { border-left: none; border-top: 1px solid var(--dsw-alias-border-l1); }
  .ap-status-counts { border-left: none; border-top: 1px solid var(--dsw-alias-border-l1); }
}
@media (max-width: 640px) {
  .ap-code { white-space: pre-wrap; overflow-wrap: anywhere; }
  .ap-table-wrap { max-height: 38vh; }
  .ap-status-counts { flex-wrap: wrap; gap: 10px; }
}
`

    function interpolate(text, params) {
      if (!params) return text
      return String(text).replace(/\{(\w+)\}/g, (match, key) => (params[key] === undefined ? match : String(params[key])))
    }

    let localeDictionaryRegistered = false

    /** Register the panel dictionaries once the locale service exists; safe to call repeatedly. */
    function registerLocaleDictionary(ctx) {
      if (localeDictionaryRegistered) return
      const locale = ctx.get('locale')
      if (!locale || typeof locale.register !== 'function') return
      try {
        ctx.effect(() => locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'agentplc:locale')
      } catch {
        // Another generation already owns this namespace; the local fallback still renders.
      }
      localeDictionaryRegistered = true
    }

    function localText(locale, key) {
      const active = (locale && typeof locale.getLocale === 'function' && locale.getLocale().active) || navigator.language || 'en'
      const table = String(active).toLowerCase().startsWith('zh') ? DICT.zh : DICT.en
      return table[key] ?? DICT.en[key] ?? key
    }

    function createTranslate(ctx) {
      const locale = ctx.get('locale')
      if (!locale || typeof locale.bind !== 'function') {
        return (key, params) => interpolate(localText(locale, key), params)
      }
      let bound
      try {
        bound = locale.bind(NS)
      } catch {
        bound = undefined
      }
      return (key, params) => {
        let text
        if (bound) {
          try {
            text = bound(key, params)
          } catch {
            text = undefined
          }
        }
        // A missing dictionary returns the key itself; fall back to the bundled copy.
        if (typeof text !== 'string' || text === '' || text === key) text = localText(locale, key)
        return interpolate(text, params)
      }
    }

    function useTranslate(ctx) {
      const locale = ctx.get('locale')
      const [, setRevision] = React.useState(0)
      React.useEffect(() => {
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => setRevision((value) => value + 1))
      }, [locale])
      // The bound translator reads the active locale at call time, so the subscription
      // above is what makes a language switch visible; the memo only avoids rebuilding it.
      return React.useMemo(() => createTranslate(ctx), [ctx, locale])
    }

    async function getJson(url, signal) {
      const response = await fetch(url, { signal, credentials: 'same-origin', headers: { accept: 'application/json' } })
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        throw new Error(text.slice(0, 160) || `HTTP ${response.status}`)
      }
      if (data && data.error) throw new Error(data.error)
      if (!response.ok && !(data && data.ok)) throw new Error(`HTTP ${response.status}`)
      return data
    }

    /** Download a generated file without navigating away when the server answers with an error. */
    async function downloadFile(url, fallbackName) {
      const response = await fetch(url, { credentials: 'same-origin' })
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const data = await response.json()
          if (data && data.error) message = data.error
        } catch {
          // A non-JSON error body keeps the status text.
        }
        throw new Error(message)
      }
      const blob = await response.blob()
      const disposition = response.headers.get('content-disposition') ?? ''
      const named = /filename\*=UTF-8''([^;]+)/i.exec(disposition)
      const fileName = named ? decodeURIComponent(named[1]) : fallbackName
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = fileName
      anchor.rel = 'noopener'
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000)
      return fileName
    }

    function formatBytes(bytes) {
      if (typeof bytes !== 'number' || !Number.isFinite(bytes)) return '—'
      if (bytes < 1024) return `${bytes} B`
      const units = ['KB', 'MB', 'GB']
      let value = bytes / 1024
      let index = 0
      while (value >= 1024 && index < units.length - 1) {
        value /= 1024
        index += 1
      }
      return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`
    }

    function formatDate(iso) {
      if (!iso) return '—'
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return iso
      return date.toLocaleString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    }

    function StatusPill({ status, t }) {
      const labels = {
        checking: t('status.checking'),
        loading: t('status.loading'),
        ready: t('status.ready'),
        error: t('status.error'),
      }
      const tone = status === 'ready' ? 'ok' : status === 'error' ? 'error' : ''
      return h(
        'span',
        { className: 'ap-pill', role: 'status', 'aria-live': 'polite' },
        h('span', { className: `ap-dot ${tone}` }),
        labels[status] ?? labels.loading,
      )
    }

    function ToolchainCards({ data, t }) {
      const checking = !data
      const environment = data?.environment
      const tia = environment?.tiaPortal
      const sysmac = environment?.sysmacStudio
      const converter = data?.converter
      const item = (tone, label, value) =>
        h(
          'div',
          { className: 'ap-status-item', key: label },
          h('span', { className: `ap-dot ${checking ? '' : tone}` }),
          h('div', { className: 'ap-status-text' }, h('span', { className: 'ap-status-label' }, label), h('span', { className: 'ap-status-value' }, value)),
        )
      const counts = data?.counts ?? { sysmac: 0, tia: 0, st: 0 }
      return h(
        'section',
        { className: 'ap-status' },
        item(
          sysmac?.installed ? 'ok' : 'warn',
          t('card.sysmac'),
          checking
            ? t('card.checking')
            : sysmac?.installed
              ? t('card.installed')
              : `${t('card.notInstalled')} · ${t('card.offline')}`,
        ),
        item(
          tia?.automationReady ? 'ok' : tia?.installed ? 'warn' : '',
          t('card.tia'),
          checking
            ? t('card.checking')
            : !tia?.installed
              ? t('card.notInstalled')
              : !tia.opennessReady
                ? t('card.opennessMissing')
                : `${(tia.installs ?? []).map((install) => install.version).join(' / ') || tia.latest || ''} · ${
                    tia.userInOpennessGroup === true ? t('card.member') : tia.userInOpennessGroup === false ? t('card.notMember') : t('card.opennessReady')
                  }`,
        ),
        item(
          converter?.ready ? 'ok' : 'warn',
          t('card.st'),
          checking ? t('card.checking') : converter?.ready ? t('card.converterReady', { python: converter.python }) : t('card.converterMissing'),
        ),
        h(
          'div',
          { className: 'ap-status-counts' },
          ['sysmac', 'tia', 'st'].map((kind) =>
            h('span', { className: 'ap-count', key: kind }, h('b', null, String(counts[kind] ?? 0)), KIND_LABEL[kind]),
          ),
        ),
      )
    }

    const KIND_LABEL = { sysmac: 'SMC2', tia: 'TIA', st: 'ST' }

    function ProjectList({ data, query, selectedPath, onSelect, t }) {
      const projects = (data?.projects ?? []).filter((project) => {
        if (!query) return true
        const needle = query.toLowerCase()
        return project.name.toLowerCase().includes(needle) || project.path.toLowerCase().includes(needle)
      })
      return h(
        'aside',
        { className: 'ap-list' },
        h(
          'div',
          { className: 'ap-list-head' },
          h('span', { className: 'ap-list-title' }, t('list.title')),
          h('span', { className: 'ap-list-count' }, String(projects.length)),
        ),
        h(
          'div',
          { className: 'ap-search-wrap' },
          h('input', {
            className: 'ap-search',
            value: query,
            placeholder: t('list.search'),
            'aria-label': t('list.search'),
            onChange: (event) => onSelect({ query: event.target.value }),
          }),
        ),
        h(
          'div',
          { className: 'ap-projects' },
          !data
            ? [0, 1, 2, 3, 4].map((index) => h('div', { className: 'ap-skeleton', key: index }))
            : projects.length === 0
              ? h(
                  'div',
                  { className: 'ap-list-note' },
                  h('div', { className: 'ap-hint' }, query ? t('list.emptyFiltered') : t('list.empty')),
                  query
                    ? null
                    : h(
                        'div',
                        { className: 'ap-hint' },
                        (data?.roots ?? []).length === 0 ? t('list.emptyNoRoots') : t('list.emptyHint'),
                      ),
                )
              : projects.map((project) =>
                  h(
                    'button',
                    {
                      key: project.path,
                      type: 'button',
                      className: `ap-project${selectedPath === project.path ? ' selected' : ''}`,
                      onClick: () => onSelect({ path: project.path }),
                      title: project.path,
                      'aria-current': selectedPath === project.path ? 'true' : undefined,
                    },
                    h(
                      'div',
                      { className: 'ap-project-top' },
                      h('span', { className: `ap-tag ${project.kind}` }, KIND_LABEL[project.kind] ?? project.kind),
                      h('span', { className: 'ap-project-name' }, project.name),
                    ),
                    h(
                      'div',
                      { className: 'ap-project-meta' },
                      `${formatDate(project.modifiedAt)} · ${project.version ?? (project.kind === 'st' ? 'ST source' : formatBytes(project.sizeBytes))}`,
                    ),
                  ),
                ),
        ),
        h(
          'div',
          { className: 'ap-list-foot' },
          data ? h('div', null, t('list.counts', data.counts ?? { sysmac: 0, tia: 0, st: 0 })) : null,
          h('div', { title: (data?.roots ?? []).join('\n') }, t('list.roots', { n: (data?.roots ?? []).length })),
          data?.generatedAt ? h('div', null, t('list.generatedAt', { time: formatDate(data.generatedAt) })) : null,
          data?.truncated ? h('div', null, t('list.truncated')) : null,
        ),
      )
    }

    function EmptyDetail({ roots, t }) {
      return h(
        'div',
        { className: 'ap-empty-wrap' },
        h(
          'div',
          { className: 'ap-empty' },
          h('span', { className: 'ap-empty-icon' }, h(PanelIcon, { size: 26 })),
          h('div', { className: 'ap-empty-title' }, t('detail.emptyTitle')),
          h('div', { className: 'ap-empty-body' }, t('detail.emptyBody')),
          roots && roots.length > 0
            ? h(
                'div',
                { className: 'ap-section' },
                h('div', { className: 'ap-section-title' }, t('list.roots', { n: roots.length })),
                h(
                  'div',
                  { className: 'ap-chips' },
                  roots.map((root) => h('span', { className: 'ap-chip', key: root }, root)),
                ),
                h('div', { className: 'ap-hint' }, t('detail.rootsConfig')),
              )
            : null,
          h('div', { className: 'ap-hint' }, t('detail.emptyHint')),
        ),
      )
    }

    function CopyButton({ text, label, t }) {
      const [status, setStatus] = React.useState('idle')
      const [nonce, setNonce] = React.useState(0)
      React.useEffect(() => {
        if (nonce === 0) return undefined
        const timer = setTimeout(() => setStatus('idle'), 2200)
        return () => clearTimeout(timer)
      }, [nonce])
      return h(
        'button',
        {
          type: 'button',
          className: 'ap-btn',
          title: text,
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(text)
              setStatus('copied')
            } catch {
              setStatus('failed')
            }
            setNonce((value) => value + 1)
          },
        },
        h('span', { 'aria-live': 'polite' }, status === 'copied' ? t('copied') : status === 'failed' ? t('copyFailed') : label ?? t('copy')),
      )
    }

    function AgentHandoff({ text, t }) {
      const [open, setOpen] = React.useState(false)
      return h(
        'div',
        { className: 'ap-handoff' },
        h(
          'div',
          { className: 'ap-handoff-head' },
          h('span', { className: 'ap-section-title' }, t('handoff.title')),
          h(
            'div',
            { className: 'ap-handoff-actions' },
            h(
              'button',
              { type: 'button', className: 'ap-btn', 'aria-expanded': open, onClick: () => setOpen((value) => !value) },
              open ? t('handoff.hide') : t('handoff.show'),
            ),
            h(CopyButton, { text, label: t('handoff.copy'), t }),
          ),
        ),
        open
          ? h('textarea', {
              className: 'ap-prompt',
              readOnly: true,
              rows: 6,
              value: text,
              'aria-label': t('handoff.title'),
              onFocus: (event) => event.target.select(),
            })
          : h('div', { className: 'ap-hint' }, t('handoff.hint')),
      )
    }

    function DownloadButton({ url, fileName, label, t, className }) {
      const [state, setState] = React.useState({ busy: false, error: null })
      return h(
        'div',
        { className: 'ap-download' },
        h(
          'button',
          {
            type: 'button',
            className: className ?? 'ap-btn',
            disabled: state.busy,
            onClick: async () => {
              setState({ busy: true, error: null })
              try {
                await downloadFile(url, fileName)
                setState({ busy: false, error: null })
              } catch (error) {
                setState({ busy: false, error: error?.message ?? String(error) })
              }
            },
          },
          state.busy ? t('download.busy') : label,
        ),
        state.error ? h('div', { className: 'ap-error' }, t('download.failed', { error: state.error })) : null,
      )
    }

    function MetaGrid({ cells }) {
      return h(
        'div',
        { className: 'ap-grid' },
        cells.filter(Boolean).map((cell, index) =>
          h(
            'div',
            { className: 'ap-cell', key: `${cell.label}-${index}` },
            h('span', { className: 'ap-cell-label' }, cell.label),
            h('span', { className: 'ap-cell-value', title: typeof cell.value === 'string' ? cell.value : undefined }, cell.value ?? '—'),
          ),
        ),
      )
    }

    function VariableTable({ rows, t }) {
      if (rows.length === 0) return h('div', { className: 'ap-hint' }, t('variables.empty'))
      return h(
        'div',
        { className: 'ap-table-wrap' },
        h(
          'table',
          { className: 'ap-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, t('variables.name')),
              h('th', null, t('variables.type')),
              h('th', null, t('variables.address')),
              h('th', null, t('variables.scope')),
            ),
          ),
          h(
            'tbody',
            null,
            rows.map((variable, index) =>
              h(
                'tr',
                { key: `${variable.table ?? ''}|${variable.name}|${variable.address ?? ''}|${index}` },
                h('td', { title: variable.comment || undefined }, variable.name),
                h('td', { className: 'mono' }, variable.dataType || '—'),
                h('td', { className: 'mono' }, variable.address || '—'),
                h('td', null, variable.scope || '—'),
              ),
            ),
          ),
        ),
      )
    }

    function SectionView({ section, t }) {
      const isSt = section.language === 'ST' && typeof section.stText === 'string'
      const rungs = Array.isArray(section.rungs) ? section.rungs : []
      return h(
        'div',
        { className: 'ap-section' },
        h(
          'div',
          { className: 'ap-section-head' },
          h('span', { className: 'ap-section-title' }, `${section.name} · ${section.language}`),
          h(
            'span',
            { className: 'ap-pou-meta' },
            section.language === 'ST'
              ? t('programs.lines', { n: section.stLines })
              : t('programs.rungs', { n: section.rungCount }),
          ),
        ),
        isSt
          ? h(
              React.Fragment,
              null,
              h('pre', { className: 'ap-code' }, section.stText),
              section.stTextTruncated ? h('div', { className: 'ap-note' }, t('st.sourceTruncated', { n: 200000 })) : null,
            )
          : rungs.length > 0
            ? h(
                React.Fragment,
                null,
                h(
                  'div',
                  { className: 'ap-rungs' },
                  rungs.map((rung, index) =>
                    h(
                      'div',
                      { className: 'ap-rung', key: index },
                      h('span', { className: 'ap-rung-index' }, `R${index + 1}`),
                      h(
                        'div',
                        { className: 'ap-rung-body' },
                        h('span', null, rung.comment ? `${rung.text}   // ${rung.comment}` : rung.text),
                        rung.stText
                          ? h(
                              'details',
                              { className: 'ap-rung-st' },
                              h('summary', null, 'ST'),
                              h('pre', { className: 'ap-code' }, rung.stText),
                            )
                          : null,
                      ),
                    ),
                  ),
                ),
                section.rungsTruncated
                  ? h('div', { className: 'ap-note' }, t('programs.truncated', { shown: rungs.length, total: section.rungCount }))
                  : null,
              )
            : h('div', { className: 'ap-hint' }, t('programs.noRungs')),
      )
    }

    function PouViewer({ projectPath, pou, t, revision }) {
      const [body, setBody] = React.useState({ loading: false, data: null, error: null })
      React.useEffect(() => {
        if (!pou) return undefined
        const controller = new AbortController()
        setBody({ loading: true, data: null, error: null })
        const url = `/agentplc/api/pou?path=${encodeURIComponent(projectPath)}&name=${encodeURIComponent(pou.name)}`
        getJson(url, controller.signal)
          .then((data) => setBody({ loading: false, data: data.pou, error: null }))
          .catch((error) => {
            if (error?.name === 'AbortError') return
            setBody({ loading: false, data: null, error: error.message })
          })
        return () => controller.abort()
      }, [projectPath, pou?.name, revision])
      if (body.loading) return h('div', { className: 'ap-spinner' }, t('loading'))
      if (body.error) return h('div', { className: 'ap-error' }, t('error.prefix', { error: body.error }))
      if (!body.data) return null
      return h(
        'div',
        { className: 'ap-section' },
        (body.data.sections ?? []).map((section) => h(SectionView, { key: section.bodyGuid ?? section.name, section, t })),
      )
    }

    function VerifyPanel({ projectPath, t }) {
      const [state, setState] = React.useState({ loading: false, data: null, error: null })
      const run = async () => {
        setState({ loading: true, data: null, error: null })
        try {
          const response = await fetch(`/agentplc/api/sysmac/verify?path=${encodeURIComponent(projectPath)}`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          const text = await response.text()
          let payload
          try {
            payload = JSON.parse(text)
          } catch {
            payload = { ok: false, error: text.slice(0, 160) || `HTTP ${response.status}` }
          }
          if (!response.ok || !payload.ok) setState({ loading: false, data: null, error: payload.error ?? `HTTP ${response.status}` })
          else setState({ loading: false, data: payload.result, error: null })
        } catch (error) {
          setState({ loading: false, data: null, error: error?.message ?? String(error) })
        }
      }
      const data = state.data
      return h(
        'div',
        { className: 'ap-section' },
        h(
          'div',
          { className: 'ap-section-head' },
          h('span', { className: 'ap-section-title' }, t('verify.title')),
          h(
            'button',
            { type: 'button', className: 'ap-btn', onClick: run, disabled: state.loading },
            state.loading ? t('verify.running') : t('verify.run'),
          ),
        ),
        state.error ? h('div', { className: 'ap-error' }, t('error.prefix', { error: state.error })) : null,
        data
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'ap-hint' },
                data.errors === 0 && data.warnings === 0
                  ? t('verify.clean')
                  : t('verify.summary', { errors: data.errors, warnings: data.warnings }),
              ),
              data.issues.length > 0
                ? h(
                    'div',
                    { className: 'ap-issues' },
                    data.issues
                      .slice(0, 60)
                      .map((issue, index) =>
                        h(
                          'div',
                          { className: `ap-issue ${issue.severity}`, key: `${index}-${issue.code}` },
                          `${issue.pou ? `${issue.pou} · ` : ''}${issue.message}`,
                        ),
                      ),
                  )
                : null,
              data.issues.length > 60 ? h('div', { className: 'ap-hint' }, t('verify.more', { n: data.issues.length - 60 })) : null,
            )
          : null,
      )
    }

    function SysmacDetail({ project, t, revision }) {
      const [tab, setTab] = React.useState('overview')
      const [query, setQuery] = React.useState('')
      const [selectedPou, setSelectedPou] = React.useState(null)
      const variables = project.variableSample ?? []
      const filtered = React.useMemo(() => {
        if (!query) return variables
        const needle = query.toLowerCase()
        return variables.filter((variable) =>
          [variable.name, variable.dataType, variable.address, variable.comment].join(' ').toLowerCase().includes(needle),
        )
      }, [variables, query])
      const pouRows = project.pous ?? []
      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'ap-actions' },
          h(DownloadButton, {
            url: `/agentplc/api/variables.csv?path=${encodeURIComponent(project.path)}`,
            fileName: `${project.name}-variables.csv`,
            label: t('variables.download'),
            t,
          }),
        ),
        h(AgentHandoff, { text: t('copy.sysmac', { path: project.path }), t }),
        h(VerifyPanel, { projectPath: project.path, t }),
        h(MetaGrid, {
          cells: [
            { label: t('meta.controller'), value: project.cpu ? `${project.cpu.model}${project.cpu.firmware ? ` / ${project.cpu.firmware}` : ''}` : t('meta.unknown') },
            { label: t('meta.pous'), value: String(pouRows.length) },
            { label: t('meta.variables'), value: String(project.variableCount ?? 0) },
            { label: t('meta.tables'), value: String((project.tables ?? []).length) },
            { label: t('meta.tasks'), value: (project.tasks ?? []).map((task) => task.name).join(', ') || '—' },
            { label: t('meta.size'), value: formatBytes(project.sizeBytes) },
            { label: t('meta.modified'), value: formatDate(project.modifiedAt) },
          ],
        }),
        h(
          'div',
          { className: 'ap-tabs', role: 'tablist' },
          ['overview', 'variables', 'programs', 'io'].map((key) =>
            h(
              'button',
              {
                key,
                type: 'button',
                role: 'tab',
                'aria-selected': tab === key,
                className: `ap-tab${tab === key ? ' active' : ''}`,
                onClick: () => setTab(key),
              },
              key === 'variables'
                ? `${t('tab.variables')} ${project.variableCount ?? ''}`.trim()
                : key === 'programs'
                  ? `${t('tab.programs')} ${pouRows.length}`.trim()
                  : key === 'io'
                    ? t('io.title')
                    : t('tab.overview'),
            ),
          ),
        ),
        tab === 'overview'
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'ap-section' },
                h('div', { className: 'ap-section-title' }, t('overview.tasks')),
                h(
                  'div',
                  { className: 'ap-chips' },
                  (project.tasks ?? []).length === 0
                    ? h('span', { className: 'ap-hint' }, t('programs.noTasks'))
                    : project.tasks.map((task) => h('span', { className: 'ap-chip', key: task.name }, `${task.name} · ${task.type}`)),
                ),
              ),
              h(
                'div',
                { className: 'ap-section' },
                h('div', { className: 'ap-section-title' }, t('overview.tables')),
                h(
                  'div',
                  { className: 'ap-chips' },
                  (project.tables ?? []).length === 0
                    ? h('span', { className: 'ap-hint' }, t('programs.noTables'))
                    : project.tables.map((table) => h('span', { className: 'ap-chip', key: table.entry }, `${table.name} · ${table.count}`)),
                ),
              ),
              h(
                'div',
                { className: 'ap-section' },
                h('div', { className: 'ap-section-title' }, t('overview.notes')),
                (project.notes ?? []).length === 0
                  ? h('div', { className: 'ap-hint' }, t('overview.noNotes'))
                  : project.notes.map((note, index) => h('div', { className: 'ap-note', key: index }, note)),
              ),
            )
          : null,
        tab === 'variables'
          ? h(
              React.Fragment,
              null,
              h('input', {
                className: 'ap-search',
                value: query,
                placeholder: t('variables.search'),
                'aria-label': t('variables.search'),
                onChange: (event) => setQuery(event.target.value),
              }),
              h(
                'div',
                { className: 'ap-hint' },
                t('variables.sampleNote', {
                  total: project.variableCount ?? 0,
                  sample: project.variableSampleSize ?? filtered.length,
                  shown: Math.min(filtered.length, 300),
                }),
              ),
              h(VariableTable, { rows: filtered.slice(0, 300), t }),
            )
          : null,
        tab === 'programs'
          ? h(
              React.Fragment,
              null,
              pouRows.length === 0
                ? h('div', { className: 'ap-hint' }, t('programs.empty'))
                : h(
                    'div',
                    { className: 'ap-pou-list' },
                    pouRows.map((pou) =>
                      h(
                        'button',
                        {
                          key: pou.name,
                          type: 'button',
                          className: `ap-pou${selectedPou?.name === pou.name ? ' active' : ''}`,
                          onClick: () => setSelectedPou(pou),
                          'aria-pressed': selectedPou?.name === pou.name,
                        },
                        h('span', { className: 'ap-pou-name' }, `${pou.name} · ${pou.type}`),
                        h(
                          'span',
                          { className: 'ap-pou-meta' },
                          [
                            pou.language === 'Mixed' ? t('programs.mixed') : pou.language === 'ST' ? t('programs.st') : t('programs.ladder'),
                            (pou.sectionCount ?? 1) > 1
                              ? t('programs.sections', { n: pou.sectionCount })
                              : pou.language === 'ST'
                                ? t('programs.lines', { n: pou.stLines })
                                : t('programs.rungs', { n: pou.rungCount }),
                          ].join(' · '),
                        ),
                      ),
                    ),
                  ),
              selectedPou ? h(PouViewer, { projectPath: project.path, pou: selectedPou, t, revision }) : h('div', { className: 'ap-hint' }, t('programs.hint')),
            )
          : null,
        tab === 'io' ? h(IoPanel, { project, t, revision }) : null,
      )
    }

    function StDetail({ project, t, revision }) {
      const [source, setSource] = React.useState({ loading: true, text: '', error: null })
      React.useEffect(() => {
        const controller = new AbortController()
        setSource({ loading: true, text: '', error: null })
        getJson(`/agentplc/api/st-source?path=${encodeURIComponent(project.path)}`, controller.signal)
          .then((data) => setSource({ loading: false, text: data.source ?? '', error: null }))
          .catch((error) => {
            if (error?.name === 'AbortError') return
            setSource({ loading: false, text: '', error: error.message })
          })
        return () => controller.abort()
      }, [project.path, revision])
      return h(
        React.Fragment,
        null,
        h(
          'div',
          { className: 'ap-actions' },
          h(DownloadButton, {
            url: `/agentplc/api/st-xml?path=${encodeURIComponent(project.path)}`,
            fileName: `${project.name}.sysmac.xml`,
            label: t('st.download'),
            className: 'ap-btn primary',
            t,
          }),
          h(DownloadButton, {
            url: `/agentplc/api/st-xml?path=${encodeURIComponent(project.path)}&format=plcopen`,
            fileName: `${project.name}.plcopen.xml`,
            label: t('st.downloadPlcopen'),
            t,
          }),
        ),
        h(AgentHandoff, { text: t('copy.st', { path: project.path }), t }),
        h('div', { className: 'ap-hint' }, t('st.formatHint')),
        h(MetaGrid, {
          cells: [
            { label: t('meta.size'), value: formatBytes(project.sizeBytes) },
            { label: t('meta.lines'), value: t('programs.lines', { n: project.lines ?? 0 }) },
            { label: t('meta.modified'), value: formatDate(project.modifiedAt) },
            { label: t('st.blocksLabel'), value: String((project.blocks ?? []).length) },
          ],
        }),
        h('div', { className: 'ap-hint' }, t('st.hint')),
        (project.blocks ?? []).length > 0
          ? h(
              'div',
              { className: 'ap-chips' },
              project.blocks.map((block) => h('span', { className: 'ap-chip', key: `${block.type}-${block.name}` }, `${block.type} ${block.name}`)),
            )
          : null,
        source.loading
          ? h('div', { className: 'ap-spinner' }, t('loading'))
          : source.error
            ? h('div', { className: 'ap-error' }, t('error.prefix', { error: source.error }))
            : h(
                React.Fragment,
                null,
                h('pre', { className: 'ap-code' }, source.text),
              ),
      )
    }

    function TiaDetail({ project, t, revision }) {
      const [state, setState] = React.useState({ loading: false, data: null, error: null })
      const readDevices = async () => {
        setState({ loading: true, data: null, error: null })
        try {
          const response = await fetch(`/agentplc/api/tia/list?path=${encodeURIComponent(project.path)}`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          const text = await response.text()
          let data
          try {
            data = JSON.parse(text)
          } catch {
            data = { ok: false, error: text.slice(0, 160) || `HTTP ${response.status}` }
          }
          if (!response.ok || !data.ok) setState({ loading: false, data: null, error: data.error ?? `HTTP ${response.status}` })
          else setState({ loading: false, data: data.data, error: null })
        } catch (error) {
          setState({ loading: false, data: null, error: error?.message ?? String(error) })
        }
      }
      const devices = state.data?.devices ?? []
      const blockNames = [...new Set(devices.flatMap((device) => (device.plc?.blocks ?? []).map((block) => block.name)))]
      const [interfaces, setInterfaces] = React.useState({ loading: false, data: null, error: null, block: null })
      const readInterfaces = async (block) => {
        setInterfaces({ loading: true, data: null, error: null, block: block ?? null })
        try {
          const params = new URLSearchParams({ path: project.path })
          if (block) params.set('block', block)
          else params.set('limit', '20')
          const response = await fetch(`/agentplc/api/tia/blocks?${params.toString()}`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          const text = await response.text()
          let payload
          try {
            payload = JSON.parse(text)
          } catch {
            payload = { ok: false, error: text.slice(0, 160) || `HTTP ${response.status}` }
          }
          if (!response.ok || !payload.ok) {
            setInterfaces({ loading: false, data: null, error: payload.error ?? `HTTP ${response.status}`, block: block ?? null })
          } else {
            setInterfaces({ loading: false, data: payload.data, error: null, block: block ?? null })
          }
        } catch (error) {
          setInterfaces({ loading: false, data: null, error: error?.message ?? String(error), block: block ?? null })
        }
      }
      const interfaceBlocks = interfaces.data?.blocks ?? []
      const [compileState, setCompileState] = React.useState({ loading: false, data: null, error: null })
      const compilePlc = async () => {
        setCompileState({ loading: true, data: null, error: null })
        try {
          const response = await fetch(`/agentplc/api/tia/compile?path=${encodeURIComponent(project.path)}`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          const text = await response.text()
          let payload
          try {
            payload = JSON.parse(text)
          } catch {
            payload = { ok: false, error: text.slice(0, 160) || `HTTP ${response.status}` }
          }
          if (!response.ok || !payload.ok) setCompileState({ loading: false, data: null, error: payload.error ?? `HTTP ${response.status}` })
          else setCompileState({ loading: false, data: payload.data, error: null })
        } catch (error) {
          setCompileState({ loading: false, data: null, error: error?.message ?? String(error) })
        }
      }
      const [deleting, setDeleting] = React.useState(false)
      const [deleteNotice, setDeleteNotice] = React.useState(null)
      const deleteBlock = async (name) => {
        if (!window.confirm(t('tia.deleteConfirm', { name }))) return
        setDeleting(true)
        setDeleteNotice(null)
        try {
          const response = await fetch('/agentplc/api/tia/delete', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({ path: project.path, blocks: [name] }),
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || !payload.ok) {
            setDeleteNotice({ error: payload.error ?? `HTTP ${response.status}` })
          } else {
            setDeleteNotice({ ok: name })
            setInterfaces({ loading: false, data: null, error: null, block: null })
            await readDevices()
          }
        } catch (error) {
          setDeleteNotice({ error: error?.message ?? String(error) })
        } finally {
          setDeleting(false)
        }
      }
      return h(
        React.Fragment,
        null,
        h(MetaGrid, {
          cells: [
            { label: t('meta.type'), value: project.version ?? 'TIA' },
            { label: t('meta.size'), value: formatBytes(project.sizeBytes) },
            { label: t('meta.modified'), value: formatDate(project.modifiedAt) },
          ],
        }),
        h('div', { className: 'ap-note' }, t('tia.noteLocal')),
        h(AgentHandoff, { text: t('copy.tia', { path: project.path }), t }),
        h(IoPanel, { project, t, revision }),
        h(
          'div',
          { className: 'ap-actions' },
          h(
            'button',
            { type: 'button', className: 'ap-btn primary', onClick: readDevices, disabled: state.loading },
            state.loading ? t('tia.reading') : t('tia.readDevices'),
          ),
          h(
            'button',
            { type: 'button', className: 'ap-btn', onClick: compilePlc, disabled: compileState.loading },
            compileState.loading ? t('tia.compiling') : t('tia.compile'),
          ),
        ),
        state.error ? h('div', { className: 'ap-error' }, t('error.prefix', { error: state.error })) : null,
        compileState.error ? h('div', { className: 'ap-error' }, t('error.prefix', { error: compileState.error })) : null,
        compileState.data
          ? h(
              'div',
              { className: 'ap-hint' },
              t('tia.compileResult', {
                state: compileState.data.state ?? '?',
                errors: compileState.data.errorCount ?? 0,
                warnings: compileState.data.warningCount ?? 0,
              }),
            )
          : null,
        deleteNotice?.error ? h('div', { className: 'ap-error' }, t('error.prefix', { error: deleteNotice.error })) : null,
        deleteNotice?.ok ? h('div', { className: 'ap-hint' }, t('tia.deleted', { name: deleteNotice.ok })) : null,
        devices.map((device) => {
          const plc = device.plc
          return h(
            'div',
            { className: 'ap-section', key: device.name },
            h(
              'div',
              { className: 'ap-section-head' },
              h('span', { className: 'ap-section-title' }, `${t('tia.device')} · ${device.name}`),
              h('span', { className: 'ap-pou-meta' }, device.type ?? ''),
            ),
            plc
              ? h(
                  React.Fragment,
                  null,
                  h(
                    'div',
                    { className: 'ap-hint' },
                    `${plc.name} · ${t('tia.blocks')} ${plc.blocks?.length ?? 0}${(plc.types ?? []).length > 0 ? ` · ${t('tia.types')} ${plc.types.length}` : ''}`,
                  ),
                  h(
                    'div',
                    { className: 'ap-chips' },
                    (plc.blocks ?? []).map((block) =>
                      h(
                        'span',
                        { className: 'ap-chip', key: block.name },
                        block.name,
                        h(
                          'button',
                          {
                            type: 'button',
                            className: 'ap-chip-del',
                            title: t('tia.deleteBlock'),
                            'aria-label': t('tia.deleteBlock'),
                            disabled: deleting,
                            onClick: () => deleteBlock(block.name),
                          },
                          '×',
                        ),
                      ),
                    ),
                  ),
                  (plc.types ?? []).length > 0
                    ? h(
                        'div',
                        { className: 'ap-chips' },
                        plc.types.map((name) => h('span', { className: 'ap-chip', key: name }, name)),
                      )
                    : null,
                )
              : h('div', { className: 'ap-hint' }, '—'),
          )
        }),
        h(
          'div',
          { className: 'ap-section', 'aria-busy': interfaces.loading ? 'true' : undefined },
          h(
            'div',
            { className: 'ap-io-head' },
            h('span', { className: 'ap-section-title' }, t('tia.interfaces')),
            h(
              'div',
              { className: 'ap-io-tools' },
              blockNames.length > 0
                ? h(
                    'select',
                    {
                      className: 'ap-select',
                      value: '',
                      'aria-label': t('tia.chooseBlock'),
                      onChange: (event) => {
                        if (event.target.value) readInterfaces(event.target.value)
                      },
                    },
                    [
                      h('option', { key: '', value: '' }, t('tia.chooseBlock')),
                      ...blockNames.map((name) => h('option', { key: name, value: name }, name)),
                    ],
                  )
                : null,
              h(
                'button',
                { type: 'button', className: 'ap-btn primary', onClick: () => readInterfaces(null), disabled: interfaces.loading },
                interfaces.loading && !interfaces.block ? t('io.reading') : t('tia.readAllInterfaces'),
              ),
            ),
          ),
          h('div', { className: 'ap-hint' }, t('tia.interfacesHint')),
          interfaces.error ? h('div', { className: 'ap-error' }, t('error.prefix', { error: interfaces.error })) : null,
          interfaceBlocks.map((block) =>
            h(
              'div',
              { className: 'ap-section', key: block.name },
              h(
                'div',
                { className: 'ap-section-head' },
                h('span', { className: 'ap-section-title' }, `${block.name}${block.kind ? ` · ${block.kind}` : ''}`),
                block.number ? h('span', { className: 'ap-pou-meta' }, `#${block.number}`) : null,
              ),
              block.interfaceError
                ? h('div', { className: 'ap-hint' }, block.interfaceError)
                : (block.sections ?? []).filter((section) => section.members.length > 0).length === 0
                  ? h('div', { className: 'ap-hint' }, t('tia.noMembers'))
                  : (block.sections ?? [])
                      .filter((section) => section.members.length > 0)
                      .map((section) =>
                        h(
                          React.Fragment,
                          { key: section.name },
                          h('div', { className: 'ap-hint' }, `${section.name} (${section.members.length})`),
                          h(
                            'div',
                            { className: 'ap-chips' },
                            section.members.map((member) =>
                              h('span', { className: 'ap-chip', key: member.name, title: member.comment || undefined }, `${member.name}: ${member.dataType}`),
                            ),
                          ),
                        ),
                      ),
            ),
          ),
        ),
        h('div', { className: 'ap-hint' }, t('tia.openHint')),
      )
    }

    const IO_DIRECTIONS = ['input', 'output', 'io', 'memory', 'internal']

    function IoTable({ rows, t }) {
      return h(
        'div',
        { className: 'ap-table-wrap' },
        h(
          'table',
          { className: 'ap-table' },
          h(
            'thead',
            null,
            h(
              'tr',
              null,
              h('th', null, t('io.direction')),
              h('th', null, t('io.name')),
              h('th', null, t('io.address')),
              h('th', null, t('io.type')),
              h('th', null, t('io.comment')),
              h('th', null, t('io.table')),
            ),
          ),
          h(
            'tbody',
            null,
            rows.map((row, index) =>
              h(
                'tr',
                { key: `${row.table}-${row.name}-${index}` },
                h('td', null, h('span', { className: `ap-dir ${row.direction}` }, t(`io.${row.direction}`))),
                h('td', null, row.name),
                h('td', { className: 'ap-io-addr', title: row.address || undefined }, row.address || '—'),
                h('td', { className: 'mono' }, row.dataType || '—'),
                h('td', { className: 'ap-io-comment', title: row.comment || undefined }, row.comment || '—'),
                h('td', { className: 'ap-io-table-name' }, row.table),
              ),
            ),
          ),
        ),
      )
    }

    function IoPanel({ project, t, revision }) {
      const [state, setState] = React.useState({ loading: false, inventory: null, error: null })
      const [direction, setDirection] = React.useState('')
      const [query, setQuery] = React.useState('')

      // A new revision means the project may have changed on disk: drop the cached view.
      React.useEffect(() => {
        setState({ loading: false, inventory: null, error: null })
      }, [revision])

      const load = async () => {
        setState((current) => ({ loading: true, inventory: current.inventory, error: null }))
        try {
          const response = await fetch(`/agentplc/api/io?path=${encodeURIComponent(project.path)}&fresh=1`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          const text = await response.text()
          let payload
          try {
            payload = JSON.parse(text)
          } catch {
            payload = { ok: false, error: text.slice(0, 200) || `HTTP ${response.status}` }
          }
          if (!response.ok || !payload.ok)
            setState((current) => ({ loading: false, inventory: current.inventory, error: payload.error ?? `HTTP ${response.status}` }))
          else setState({ loading: false, inventory: payload.inventory, error: null })
        } catch (error) {
          setState((current) => ({ loading: false, inventory: current.inventory, error: error?.message ?? String(error) }))
        }
      }

      const inventory = state.inventory
      const items = inventory?.items ?? []
      const counts = inventory?.counts ?? {}
      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        return items.filter(
          (item) =>
            (direction === '' || item.direction === direction) &&
            (needle === '' ||
              [item.name, item.address, item.dataType, item.comment, item.table, item.pou].join(' ').toLowerCase().includes(needle)),
        )
      }, [items, direction, query])
      const shown = filtered.slice(0, 400)

      return h(
        'div',
        { className: 'ap-section', 'aria-busy': state.loading ? 'true' : undefined },
        h(
          'div',
          { className: 'ap-io-head' },
          h('span', { className: 'ap-section-title' }, t('io.title')),
          h(
            'div',
            { className: 'ap-io-tools' },
            inventory
              ? h(DownloadButton, {
                  url: `/agentplc/api/io.csv?path=${encodeURIComponent(project.path)}`,
                  fileName: `${project.name}-io.csv`,
                  label: t('io.csv'),
                  t,
                })
              : null,
            h(
              'button',
              { type: 'button', className: 'ap-btn primary', onClick: load, disabled: state.loading },
              state.loading ? t('io.reading') : inventory ? t('io.reload') : t('io.read'),
            ),
          ),
        ),
        h('div', { className: 'ap-hint' }, project.kind === 'tia' ? t('io.noteTia') : t('io.note')),
        state.error ? h('div', { className: 'ap-error' }, t('error.prefix', { error: state.error })) : null,
        inventory
          ? h(
              React.Fragment,
              null,
              h(
                'div',
                { className: 'ap-io-counts' },
                [['', t('io.all'), counts.total ?? 0], ...IO_DIRECTIONS.map((key) => [key, t(`io.${key}`), counts[key] ?? 0])].map(
                  ([value, label, count]) =>
                    h(
                      'button',
                      {
                        key: value || 'all',
                        type: 'button',
                        className: `ap-chip filter${direction === value ? ' active' : ''}`,
                        onClick: () => setDirection(value),
                        'aria-pressed': direction === value,
                      },
                      `${label} ${count}`,
                    ),
                ),
              ),
              items.length === 0
                ? h('div', { className: 'ap-hint' }, t('io.empty'))
                : (counts.addressed ?? 0) === 0
                  ? h('div', { className: 'ap-note' }, t('io.noAddress'))
                  : null,
              items.length > 0
                ? h(
                    React.Fragment,
                    null,
                    h(
                      'div',
                      { className: 'ap-io-tools' },
                      h('input', {
                        className: 'ap-search',
                        value: query,
                        placeholder: t('io.search'),
                        'aria-label': t('io.search'),
                        onChange: (event) => setQuery(event.target.value),
                      }),
                      h('span', { className: 'ap-hint' }, t('io.rows', { shown: shown.length, total: filtered.length })),
                    ),
                    shown.length > 0
                      ? h(IoTable, { rows: shown, t })
                      : h('div', { className: 'ap-hint' }, t('variables.empty')),
                  )
                : null,
            )
          : null,
      )
    }

    function ProjectDetail({ detail, t, revision }) {
      return h(
        'section',
        { className: 'ap-detail' },
        h(
          'div',
          { className: 'ap-detail-head' },
          h(
            'div',
            { className: 'ap-detail-title' },
            h('span', { className: `ap-tag ${detail.kind}` }, KIND_LABEL[detail.kind] ?? detail.kind),
            h('span', { className: 'ap-detail-name' }, detail.name),
          ),
          h('div', { className: 'ap-path' }, detail.path),
        ),
        detail.kind === 'sysmac' ? h(SysmacDetail, { key: detail.path, project: detail, t, revision }) : null,
        detail.kind === 'st' ? h(StDetail, { key: detail.path, project: detail, t, revision }) : null,
        detail.kind === 'tia' ? h(TiaDetail, { key: detail.path, project: detail, t, revision }) : null,
      )
    }

    function CreateDialog({ t, projects, roots, onClose, onCreated }) {
      const scanned = React.useMemo(() => (projects ?? []).filter((project) => project.kind === 'sysmac'), [projects])
      const [examples, setExamples] = React.useState([])
      const [template, setTemplate] = React.useState('')
      React.useEffect(() => {
        const controller = new AbortController()
        fetch('/agentplc/api/examples', { credentials: 'same-origin', headers: { accept: 'application/json' }, signal: controller.signal })
          .then((response) => response.json())
          .then((data) => setExamples(Array.isArray(data?.examples) ? data.examples : []))
          .catch(() => {})
        return () => controller.abort()
      }, [])
      const templates = React.useMemo(() => {
        const seen = new Set(scanned.map((project) => project.path))
        return [...scanned, ...examples.filter((example) => !seen.has(example.path))]
      }, [scanned, examples])
      React.useEffect(() => {
        if (!template && templates.length > 0) setTemplate(templates[0].path)
      }, [template, templates])
      const [projectName, setProjectName] = React.useState('AgentPLC_新建工程')
      const [output, setOutput] = React.useState('')
      const [variablesMode, setVariablesMode] = React.useState('keep')
      const [pouName, setPouName] = React.useState('')
      const [pouBody, setPouBody] = React.useState('IF P_First_Run THEN\n    RETURN;\nEND_IF;')
      const [compile, setCompile] = React.useState(false)
      const [overwrite, setOverwrite] = React.useState(false)
      const [status, setStatus] = React.useState({ running: false, error: null, result: null })

      const isUnderRoots = (value) => {
        const target = String(value ?? '').toLowerCase()
        return (roots ?? []).some((root) => {
          const base = String(root).toLowerCase().replace(/[\\/]+$/, '')
          return base !== '' && (target === base || target.startsWith(`${base}\\`) || target.startsWith(`${base}/`))
        })
      }

      const close = () => {
        if (!status.running) onClose()
      }
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key === 'Escape' && !status.running) onClose()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
      }, [status.running, onClose])
      const submit = async () => {
        if (!template) {
          setStatus({ running: false, error: 'template missing', result: null })
          return
        }
        setStatus({ running: true, error: null, result: null })
        try {
          const response = await fetch('/agentplc/api/create', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { accept: 'application/json', 'content-type': 'application/json' },
            body: JSON.stringify({
              template,
              projectName,
              variablesMode,
              compile,
              overwrite,
              output: output.trim() || undefined,
              newPous: pouName.trim() ? [{ name: pouName.trim(), stText: pouBody }] : undefined,
            }),
          })
          const payload = await response.json()
          if (!response.ok || !payload.ok) {
            setStatus({ running: false, error: payload.error ?? `HTTP ${response.status}`, result: null })
            return
          }
          setStatus({ running: false, error: null, result: payload })
          onCreated(payload.path)
        } catch (error) {
          setStatus({ running: false, error: error?.message ?? String(error), result: null })
        }
      }

      return h(
        'div',
        {
          className: 'ap-modal',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('create.title'),
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) close()
          },
        },
        h(
          'div',
          { className: 'ap-modal-card' },
          h(
            'div',
            { className: 'ap-modal-head' },
            h('span', null, t('create.title')),
            h('button', { type: 'button', className: 'ap-icon-btn', onClick: close, 'aria-label': t('create.cancel') }, '×'),
          ),
          h(
            'label',
            { className: 'ap-field' },
            t('create.template'),
            h(
              'select',
              { value: template, onChange: (event) => setTemplate(event.target.value) },
              templates.map((project) =>
                h(
                  'option',
                  { key: project.path, value: project.path },
                  project.bundled ? `${t('create.example')} · ${project.name}` : `${project.name} — ${project.path}`,
                ),
              ),
            ),
          ),
          h('label', { className: 'ap-field' }, t('create.name'), h('input', { value: projectName, onChange: (event) => setProjectName(event.target.value) })),
          h(
            'label',
            { className: 'ap-field' },
            t('create.output'),
            h('input', { value: output, placeholder: t('create.outputHint'), onChange: (event) => setOutput(event.target.value) }),
          ),
          h(
            'label',
            { className: 'ap-field' },
            t('create.variablesMode'),
            h(
              'select',
              { value: variablesMode, onChange: (event) => setVariablesMode(event.target.value) },
              [
                ['replace', t('create.modeReplace')],
                ['merge', t('create.modeMerge')],
                ['keep', t('create.modeKeep')],
              ].map(([value, label]) => h('option', { key: value, value }, label)),
            ),
          ),
          h('label', { className: 'ap-field' }, t('create.pouName'), h('input', { value: pouName, onChange: (event) => setPouName(event.target.value) })),
          h('label', { className: 'ap-field' }, t('create.pouBody'), h('textarea', { value: pouBody, onChange: (event) => setPouBody(event.target.value) })),
          h(
            'label',
            { className: 'ap-check' },
            h('input', { type: 'checkbox', checked: compile, onChange: (event) => setCompile(event.target.checked) }),
            t('create.compile'),
          ),
          h(
            'label',
            { className: 'ap-check' },
            h('input', { type: 'checkbox', checked: overwrite, onChange: (event) => setOverwrite(event.target.checked) }),
            t('create.overwrite'),
          ),
          status.error ? h('div', { className: 'ap-error' }, t('create.error', { error: status.error })) : null,
          status.result
            ? h(
                'div',
                { className: 'ap-create-result' },
                h('div', { className: 'ap-hint' }, t('create.success', { path: status.result.path })),
                h(
                  'div',
                  { className: 'ap-hint' },
                  t('create.verify', { errors: status.result.verificationErrors ?? 0, warnings: status.result.verificationWarnings ?? 0 }),
                ),
                status.result.compile
                  ? h(
                      'div',
                      { className: status.result.compile.ok ? 'ap-hint' : 'ap-error' },
                      t('create.compileResult', {
                        errors: status.result.compile.errorCount ?? '?',
                        warnings: status.result.compile.warningCount ?? '?',
                      }),
                    )
                  : null,
                status.result.newPous?.length
                  ? h(
                      'div',
                      { className: 'ap-hint' },
                      t('create.newPous', { names: status.result.newPous.map((pou) => `${pou.name}${pou.task ? ` · ${pou.task}` : ''}`).join(', ') }),
                    )
                  : null,
                status.result.backupPath ? h('div', { className: 'ap-hint' }, t('create.backup', { path: status.result.backupPath })) : null,
                !isUnderRoots(status.result.path) ? h('div', { className: 'ap-note' }, t('create.outsideRoots')) : null,
              )
            : null,
          h(
            'div',
            { className: 'ap-modal-actions' },
            h('button', { type: 'button', className: 'ap-btn', onClick: close, disabled: status.running }, t('create.cancel')),
            h(
              'button',
              { type: 'button', className: 'ap-btn primary', onClick: submit, disabled: status.running || !template },
              status.running ? t('create.running') : t('create.submit'),
            ),
          ),
        ),
      )
    }

    function Panel({ ctx }) {
      const t = useTranslate(ctx)
      // The locale service may load after this plugin; register the dictionaries on first paint too.
      React.useEffect(() => registerLocaleDictionary(ctx), [ctx])
      const [state, setState] = React.useState({ loading: true, data: null, error: null })
      const [query, setQuery] = React.useState('')
      const [selectedPath, setSelectedPath] = React.useState(null)
      const [detail, setDetail] = React.useState({ loading: false, data: null, error: null })
      const [refreshToken, setRefreshToken] = React.useState(0)
      const [detailToken, setDetailToken] = React.useState(0)
      const [createOpen, setCreateOpen] = React.useState(false)
      const [rootInput, setRootInput] = React.useState('')
      const [rootsInfo, setRootsInfo] = React.useState(null)
      const [rootsOpen, setRootsOpen] = React.useState(false)
      const [selectedRoots, setSelectedRoots] = React.useState([])

      React.useEffect(() => {
        const controller = new AbortController()
        let timedOut = false
        const timer = setTimeout(() => {
          timedOut = true
          controller.abort()
        }, 45000)
        setState((current) => ({ ...current, loading: true, error: null }))
        getJson(`/agentplc/api/state${refreshToken > 0 ? '?refresh=1' : ''}`, controller.signal)
          .then((data) => setState({ loading: false, data, error: null }))
          .catch((error) => {
            if (error?.name === 'AbortError' && !timedOut) return
            setState((current) => ({ loading: false, data: current.data, error: timedOut ? 'timeout' : error?.message ?? String(error) }))
          })
          .finally(() => clearTimeout(timer))
        return () => {
          clearTimeout(timer)
          controller.abort()
        }
      }, [refreshToken])

      React.useEffect(() => {
        if (!selectedPath) {
          setDetail({ loading: false, data: null, error: null })
          return undefined
        }
        const controller = new AbortController()
        let timedOut = false
        const timer = setTimeout(() => {
          timedOut = true
          controller.abort()
        }, 45000)
        setDetail({ loading: true, data: null, error: null })
        getJson(`/agentplc/api/project?path=${encodeURIComponent(selectedPath)}`, controller.signal)
          .then((data) => setDetail({ loading: false, data: data.project, error: null }))
          .catch((error) => {
            if (error?.name === 'AbortError' && !timedOut) return
            setDetail({ loading: false, data: null, error: timedOut ? 'timeout' : error?.message ?? String(error) })
          })
          .finally(() => clearTimeout(timer))
        return () => {
          clearTimeout(timer)
          controller.abort()
        }
      }, [selectedPath, detailToken])

      const handleSelect = React.useCallback(
        (change) => {
          if (change.query !== undefined) setQuery(change.query)
          if (change.path === undefined) return
          if (change.path === selectedPath) setDetailToken((value) => value + 1)
          else setSelectedPath(change.path)
        },
        [selectedPath],
      )

      const encodePath64 = (value) => {
        const bytes = new TextEncoder().encode(value)
        let binary = ''
        for (const byte of bytes) binary += String.fromCharCode(byte)
        return btoa(binary)
      }

      const [rootError, setRootError] = React.useState(null)

      const addRootPath = async (value) => {
        const trimmed = String(value ?? '').trim()
        if (!trimmed) return false
        try {
          const response = await fetch(`/agentplc/api/roots?action=add&path64=${encodeURIComponent(encodePath64(trimmed))}`, {
            credentials: 'same-origin',
            headers: { accept: 'application/json' },
          })
          const payload = await response.json().catch(() => ({}))
          if (!response.ok || payload.ok === false) {
            setRootError(t('roots.addFailed', { error: payload.error ?? `HTTP ${response.status}` }))
            return false
          }
          setRootError(null)
          setRefreshToken((token) => token + 1)
          return true
        } catch (error) {
          setRootError(t('roots.addFailed', { error: error?.message ?? String(error) }))
          return false
        }
      }

      /** The Host-native picker is the only reliable way to get a folder path in the desktop shell. */
      const browseFolder = async () => {
        const uiWorkspace = typeof ctx.get === 'function' ? ctx.get('uiWorkspace') : undefined
        if (!uiWorkspace || typeof uiWorkspace.pickDirectory !== 'function') {
          setRootError(t('roots.pickUnavailable'))
          return
        }
        try {
          const picked = await uiWorkspace.pickDirectory()
          if (picked) await addRootPath(picked)
        } catch (error) {
          setRootError(t('roots.addFailed', { error: error?.message ?? String(error) }))
        }
      }

      const addRoot = async () => {
        if (await addRootPath(rootInput)) setRootInput('')
      }

      React.useEffect(() => {
        fetch('/agentplc/api/roots', { credentials: 'same-origin', headers: { accept: 'application/json' } })
          .then((response) => response.json())
          .then((data) => setRootsInfo(data))
          .catch(() => {})
      }, [refreshToken])

      const selected = (state.data?.projects ?? []).find((project) => project.path === selectedPath)
      const status = !state.data && state.loading ? 'checking' : state.error ? 'error' : state.loading ? 'loading' : 'ready'
      return h(
        'div',
        { className: 'ap-root' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        createOpen
          ? h(CreateDialog, {
              t,
              projects: state.data?.projects,
              roots: state.data?.roots,
              onClose: () => setCreateOpen(false),
              onCreated: () => {
                setRefreshToken((value) => value + 1)
              },
            })
          : null,
        h(
          'header',
          { className: 'ap-top' },
          h(
            'div',
            { className: 'ap-brand' },
            h('span', { className: 'ap-brand-mark' }, h(PanelIcon, { size: 22 })),
            h(
              'div',
              { className: 'ap-title' },
              h('span', { className: 'ap-title-main' }, t('title')),
              h('span', { className: 'ap-title-sub' }, t('subtitle')),
            ),
          ),
          h(
            'div',
            { className: 'ap-header-actions' },
            h('input', {
              type: 'text',
              className: 'ap-input',
              placeholder: t('roots.placeholder'),
              'aria-label': t('roots.placeholder'),
              value: rootInput,
              onChange: (event) => setRootInput(event.target.value),
              onKeyDown: (event) => {
                if (event.key === 'Enter') addRoot()
              },
            }),
            h('button', { type: 'button', className: 'ap-btn', onClick: addRoot }, t('roots.add')),
            h(
              'button',
              {
                type: 'button',
                className: 'ap-btn',
                onClick: browseFolder,
              },
              t('roots.browse'),
            ),
            h('button', { type: 'button', className: 'ap-btn primary', onClick: () => setCreateOpen(true) }, t('create.title')),
            h(StatusPill, { status, t }),
            h(
              'button',
              {
                type: 'button',
                className: 'ap-icon-btn',
                title: t('refresh'),
                'aria-label': t('refresh'),
                onClick: () => {
                  setRefreshToken((value) => value + 1)
                  if (selectedPath) setDetailToken((value) => value + 1)
                },
              },
              RefreshIcon(),
            ),
          ),
        ),
        (rootsInfo?.user ?? []).length > 0
          ? h(
              'div',
              { className: 'ap-roots' },
              h(
                'button',
                { type: 'button', className: 'ap-btn', onClick: () => setRootsOpen((value) => !value) },
                t('roots.list', { n: (rootsInfo.user ?? []).length }),
              ),
              rootsOpen
                ? h(
                    'div',
                    { className: 'ap-roots-panel' },
                    (rootsInfo.user ?? []).map((root) =>
                      h(
                        'label',
                        { key: root, className: 'ap-root-item' },
                        h('input', {
                          type: 'checkbox',
                          checked: selectedRoots.includes(root),
                          onChange: (event) =>
                            setSelectedRoots((current) =>
                              event.target.checked ? [...current, root] : current.filter((item) => item !== root),
                            ),
                        }),
                        h('span', { className: 'ap-root-path' }, root),
                      ),
                    ),
                    h(
                      'div',
                      { className: 'ap-roots-actions' },
                      h(
                        'button',
                        {
                          type: 'button',
                          className: 'ap-btn',
                          disabled: selectedRoots.length === 0,
                          onClick: async () => {
                            const removed = []
                            let failure = null
                            for (const root of selectedRoots) {
                              try {
                                const response = await fetch(
                                  `/agentplc/api/roots?action=remove&path64=${encodeURIComponent(encodePath64(root))}`,
                                  { credentials: 'same-origin', headers: { accept: 'application/json' } },
                                )
                                const payload = await response.json().catch(() => ({}))
                                if (!response.ok || payload.ok === false) failure = payload.error ?? `HTTP ${response.status}`
                                else removed.push(root)
                              } catch (error) {
                                failure = error?.message ?? String(error)
                              }
                            }
                            setRootError(failure ? t('roots.removeFailed', { error: failure }) : null)
                            setSelectedRoots([])
                            setRootsOpen(false)
                            setRefreshToken((value) => value + 1)
                            if (removed.length > 0) {
                              setSelectedPath((current) =>
                                current && removed.some((root) => current.toLowerCase().startsWith(root.toLowerCase())) ? null : current,
                              )
                            }
                          },
                        },
                        t('roots.deleteSelected'),
                      ),
                    ),
                  )
                : null,
            )
          : null,
        rootError ? h('div', { className: 'ap-error ap-error-bar' }, rootError) : null,
        state.error ? h('div', { className: 'ap-error ap-error-bar' }, t('error.prefix', { error: state.error })) : null,
        h(ToolchainCards, { data: state.data, t }),
        h(
          'div',
          { className: 'ap-body' },
          h(ProjectList, { data: state.data, query, selectedPath, onSelect: handleSelect, t }),
          detail.loading
            ? h(
                'section',
                { className: 'ap-detail' },
                h('div', { className: 'ap-skeleton line', style: { width: '42%' } }),
                h('div', { className: 'ap-skeleton line', style: { width: '68%' } }),
                h('div', { className: 'ap-skeleton', style: { height: 96 } }),
                h('div', { className: 'ap-skeleton', style: { height: 160 } }),
              )
            : detail.error
              ? h(
                  'section',
                  { className: 'ap-detail' },
                  selected
                    ? h(
                        'div',
                        { className: 'ap-detail-head' },
                        h(
                          'div',
                          { className: 'ap-detail-title' },
                          h('span', { className: `ap-tag ${selected.kind}` }, KIND_LABEL[selected.kind] ?? selected.kind),
                          h('span', { className: 'ap-detail-name' }, selected.name),
                        ),
                        h('div', { className: 'ap-path' }, selected.path),
                      )
                    : null,
                  h('div', { className: 'ap-error' }, t('error.prefix', { error: detail.error })),
                  h('div', { className: 'ap-actions' }, h('button', { type: 'button', className: 'ap-btn', onClick: () => setDetailToken((value) => value + 1) }, t('retry'))),
                )
              : detail.data
                ? h(ProjectDetail, { detail: detail.data, t, revision: detailToken })
                : h('section', { className: 'ap-detail' }, h(EmptyDetail, { roots: state.data?.roots, t })),
        ),
      )
    }

    function RefreshIcon() {
      return h(
        'svg',
        { width: 15, height: 15, viewBox: '0 0 24 24', 'aria-hidden': true, style: { display: 'block' } },
        h('path', { d: 'M20 12a8 8 0 1 1-2.34-5.66', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' }),
        h('path', { d: 'M20 4v5h-5', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }),
      )
    }

    function PanelIcon({ size = 18, active = false }) {
      const stroke = 'currentColor'
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 36 36',
          'aria-hidden': true,
          style: { display: 'block', opacity: active ? 1 : 0.9 },
        },
        h('rect', { x: 4.5, y: 7.5, width: 27, height: 21, rx: 3.5, fill: 'none', stroke, strokeWidth: 2.2 }),
        h('path', { d: 'M10.5 7.5V3.2M17.5 7.5V3.2M24.5 7.5V3.2', stroke, strokeWidth: 1.9, strokeLinecap: 'round' }),
        h('path', { d: 'M10.5 28.5v4.3M17.5 28.5v4.3M24.5 28.5v4.3', stroke, strokeWidth: 1.9, strokeLinecap: 'round' }),
        h('path', { d: 'M12.2 12.5v11M21.4 12.5v11', stroke, strokeWidth: 1.7, strokeLinecap: 'round' }),
        h('path', { d: 'M12.2 18h3.4', stroke, strokeWidth: 1.7, strokeLinecap: 'round' }),
        h('circle', { cx: 23, cy: 18, r: 2.9, fill: 'none', stroke, strokeWidth: 1.7 }),
        h('path', { d: 'M25.9 18h4.6', stroke, strokeWidth: 1.7, strokeLinecap: 'round' }),
      )
    }

    function apply(ctx) {
      registerLocaleDictionary(ctx)
      const t = createTranslate(ctx)
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'agentplc',
            order: 20,
            label: () => t('nav.label'),
          },
          PanelIcon,
        ),
      )
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: 'agentplc',
          },
          (props) => h(Panel, { ...props, ctx }),
        ),
      )
    }

    return { inject: ['slots'], apply }
  },
})
