# PLC 工程台 · AgentPLC workspace

左侧栏里的 PLC 工程工作区，把对话、工程工具和项目知识放在同一个面板里。当前版本聚焦两条线：**欧姆龙 Sysmac Studio** 和 **西门子 TIA Portal**。

## 面板能做什么

- **离线读 `.smc2`**：不需要装 Sysmac Studio。控制器型号/固件、任务、POU 列表、每个 POU 的 ST 源码或梯形图梯级、全局与局部变量表都能读出来，变量表可一键导出 CSV。
- **统一 IO 清单**：把欧姆龙和西门子的地址收敛成同一张表——每条变量/标签标成**输入 / 输出 / IO 区 / 存储 / 内部**，带地址、数据类型、注释和所属变量表（局部表会标出所属 POU）。`.smc2` 离线解析；博途工程走 Openness。面板可筛选、导出 CSV，Agent 用 `plc_io` 读同一份数据。只读，不会替你分配地址。
  识别范围：欧姆龙 `ECAT://node#[1,2]/Input Bit ...`、`IOBus://unit#2/...`、`BuiltInIO://cpu/#0/Input_Bit_00`、`%I/%Q`、`%D`（DM，归存储）、`D/W/H/A/E`、`CIO`（方向不明，归 IO 区）、`MC://_MC_AX[0]`（运动轴，归 IO 区）；西门子 `%I*` 输入、`%Q*` 输出、`%M*` 存储，无地址的标签归内部。
- **识别博途工程**：不要求文件夹名以 `.ap16/.ap18` 结尾——只要文件夹里有 `<name>.ap16/.ap18` 文件（旁边有 `System/`、`IM/` 等项目结构）就会被识别，并标出版本。点「读取设备与块」会通过 Openness 列出设备和全部程序块（首次会启动后台 TIA，约 20–40 秒）。
- **静态校验**：选中 `.smc2` 点「运行校验」，离线检查未声明标识符、重复变量、重复 AT 地址、IF/CASE/FOR/WHILE 块不配平，直接列出 POU 和行号；生成工程时自动跑一次。
- **ST → Sysmac XML**：把 `.st` 源文件（`TYPE` / `FUNCTION_BLOCK` / `PROGRAM`）转换成 Sysmac Studio 可导入的 **IEC 61131-10 XML**。转换器沿用工作区里已用官方 XSD 校验过的那套实现。
- **博途 Openness**：用官方 `Siemens.Engineering` 接口列设备/块、导入 SCL 外部源并编译、编译 PLC、导出块 XML、读标签表，以及**读块接口**（`readBlocks`：输入/输出/InOut/Static/Temp/Constant 成员，带类型、起始值和注释）。`plan` 只生成命令文件不动博途，`run` 才真正连博途。
- **工具链体检**：TIA Portal / Openness 程序集 / `Siemens TIA Openness` 用户组、Sysmac Studio、.NET Framework、PowerShell、Python 3，一次看清。

## 直接生成工程文件

这是给 Agent 用的主路径：你描述要求，Agent 写 ST/SCL，插件把结果落成工程文件。

### 欧姆龙 `.smc2`（已验证可被 Sysmac 打开）

`plc_sysmac` 的 `create` 动作以**一个现有工程为模板**，把内容写进模板再打包：

```jsonc
{
  "action": "create",
  "template": "D:\\Desktop\\模板.smc2",        // 模板：决定控制器、POU 集合、任务、IO 配置
  "output": "D:\\项目\\输送线.smc2",
  "projectName": "输送线",
  "controller": "NX502-1600 Ver. 1.66",         // 可选，改的就是 manifest 里的 SetUnit 字符串
  "variables": [                                 // 全局变量表；variablesMode 默认 replace
    { "name": "启动按钮", "dataType": "BOOL", "comment": "HMI 启动" },
    { "name": "伸出输出", "dataType": "BOOL", "address": "ECAT://node#[2,0]/..." }
  ],
  "pous": [                                      // 按名字写模板里已有的 POU 的 ST 正文
    { "name": "PRG_Init", "stText": "IF P_First_Run THEN ... END_IF;" }
  ],
  "variablesMode": "replace"                     // replace | merge | keep
}
```

生成后用 `plc_sysmac overview` 复查，或在 Sysmac Studio 里直接打开编译。已实测：改名、换变量表、写 ST 正文、改控制器字符串这四类改动单独和组合都通过；用 11 个 ST POU、25 个变量的中文示例生成的 `.smc2`，在 Sysmac Studio 中打开显示为 `AgentPLC_示例项目示例 - new_Controller_0`。

生成后默认自动跑一次**静态校验**（`verify: false` 可关闭），结果写在工具返回里；也可以用 `plc_sysmac` 的 `verify` 动作单独复查。校验不是原厂编译器：它抓的是生成最容易犯的错（未声明变量、重复定义、地址冲突、块不配平）。

要**生成后立刻拿原厂编译结果**，给 `create` 加 `compile: true`：写完工程就复制副本、提权打开 Sysmac、跑 F7 + 重编译，并把真实错误带回来。实测一个「漏声明变量」的闭环：

```
第 1 次 create（compile=true）→ Vendor compile: 2 error(s) — 未定义的标识符'启动按钮' (PRG_Init line 2, column 5) …
第 2 次 create（variablesMode=merge，补上 启动按钮/报警灯）→ Static check: 0；Vendor compile: 0 error(s), 0 warning(s)
```

- **新增 POU**：`create` 的 `newPous: [{name, stText, variables}]` 会克隆模板里的 ST 程序实体（新 GUID、正文、局部变量表），重名直接报错，失败时删除半成品。**任务分配默认留给你**：新程序不会挂到任何任务，结果里会写明 `task: null`；要挂到某个任务就传 `taskName`（或 `associateTask: true` 挂到第一个任务）。实测新增 `PRG_NewDemo2`（局部变量 `计数2`）后原厂编译 `0 error(s), 0 warning(s)`。

错误用来改，警告一般可以忽略（`warningCount` 仍会返回，但不挡流程）。也可以单独用 `plc_sysmac action=compile path=...` 复查，它会复制一份工程、先按 F7「检查所有程序」、再「重编译控制器」，重编译确认框自动点「是(Y)」，然后读回错误/警告数量和每条消息（含 POU、行、列）。实测坏工程返回：

```
2 error(s), 0 warning(s)
未定义的标识符'未声明变量A' (PRG_Init line 3, column 5)
未定义的标识符'未声明变量B' (PRG_Init line 4, column 5)
```

这个动作每次会弹一次 UAC（Sysmac 本身要求管理员权限），工程原件不会被改动（操作的是临时副本），跑完自动关闭探针实例。编译窗口是自绘界面，主通道是 UIA 文本，另保留截图 + OCR 作兜底（`keepScreenshot: true` 可留图）。

模板策略的边界：

- **POU 集合由模板决定**。`pous` 里给模板没有的名字会被跳过并提示；要新增/删除 POU，先用 Sysmac Studio 建一个带这些 POU 的模板工程。
- **只改 ST 正文**。梯形图 POU、局部变量表、任务配置、IO 映射保持模板原样。
- 模板里的其它 POU 若引用被替换掉的全局变量，编译会报未声明；要干净通过就用 `variablesMode: merge` 保留模板变量，或把所有 POU 都替换掉。

### 西门子 `.ap16` / `.ap18`（Openness，已实测可生成）

本机 V16 用得比 V18 多，所以**默认走 V16**：`tiaDefaultVersion: V16`。`projectPath` 可以只写到工程名，带上 `version` 就会补成对应后缀；路径里已带 `.ap16/.ap18` 时以后缀为准。

```jsonc
{
  "action": "run",                 // 先 plan 审查命令，再 run
  "operation": "create",
  "projectPath": "D:\\项目\\Line1",  // 不写后缀 → 按 version 补成 Line1.ap16
  "version": "V16",               // 省略时用 agentplc.tiaDefaultVersion
  "projectName": "Line1",
  "deviceOrderNumber": "OrderNumber:6ES7 214-1AG40-0XB0/V4.4",
  "sourceFiles": ["D:\\项目\\FB_Main.scl"]  // 可选：建完设备后导入 SCL 并编译
}
```

已在本机验证：

- `plc_tia run create` 生成 `AgentPlcV16.ap16`（V16 API，PLC_1 设备，导入 `FB_Conveyor.scl`，编译 `Success`）。
- 同一工程上 `list` 读回 `Main, FB_Conveyor`，`importScl` 返回 `state: Success`，`compile` 返回 `Success`。
- 不写后缀、也不传 `version` 时按 `tiaDefaultVersion` 建 `.ap16`：`V16Final` 工程（PLC_1 + `FB_Conveyor`，编译 `Success`，`list` 读回 `Main, FB_Conveyor`）。
- 传文件夹路径（如 `...\LineV16`）也能自动找到里面的 `.ap16` 工程文件。
- V18 同样可用：`AgentPlcDemo.ap18`（V18 API，PLC_1，导入 `FB_Conveyor.scl`，编译 `Success`，`list` 读回 `Main, FB_Conveyor`）。
- 偶发 `Connection to TiaPortal failed.` 是 TIA 后台实例没连上，工具会自动重试一次；仍失败时再调一次即可。
- 前提是当前 Windows 用户已加入 `Siemens TIA Openness` 组并**重新登录**（本机已完成）。Openness 首次调用 TIA 时可能弹出「Openness 访问」授权框，选「全部确定」后不再询问。

驱动实现上有两个不显然的点：PLC 软件要通过 `SoftwareContainer` 服务取（`PlcSoftware` 不满足泛型 `GetService<T>` 的约束），外部源导入用 `ExternalSources.CreateFromFile(name, path)` 再 `GenerateBlocksFromSource`，编译用 `ICompilable.Compile()`；PowerShell 绑不了泛型 `GetService<T>()`，驱动里用反射调用闭合泛型方法。

## 入口

会话列表上方的全局面板图标里多一个 **PLC 工程台**（排在 Plugins、Schedules 之后）；点开后是主面板。侧栏标签、面板文案都走 DSH 的语言服务，中英文都提供。

主面板的用法：

- 左栏列出扫描目录里的 `.smc2` / 博途工程目录 / `.st` 源文件，可搜索。
- 选 `.smc2`：概览（控制器、任务、变量表、解析提示）、**IO 清单**、变量（搜索 + 下载 CSV）、程序（POU 列表 → ST 源码或梯形图逐级；MultipartLadder 的每一段分开显示，内嵌 ST 可展开）。
- 选 `.st`：预览源码，一键生成并下载 Sysmac 可导入的 XML；失败时面板内显示原因，不会跳转。
- 选博途工程：说明为什么必须走 Openness，给出可复制的 Agent 指令；**IO 清单**同样能读（后台启动博途，约 40 秒）。
- 顶部三张卡片是环境体检；「刷新」会重新扫描目录并重读当前工程。

## Agent 工具

| 工具 | 用途 |
|---|---|
| `plc_env` | 探测本机 PLC 工具链（只读） |
| `plc_sysmac` | `scan` / `overview` / `variables` / `pou` / `export-variables` / `design` / `create` / `verify` / `compile`：读写 `.smc2`、静态校验、原厂编译 |
| `plc_st` | `scan` / `convert`：`.st` → Sysmac 可导入的 IEC 61131-10 XML |
| `plc_tia` | `plan` / `run`：通过 TIA Openness 建工程、列块、导入 SCL、编译、导出块、读标签表、读块接口（`readBlocks`） |
| `plc_io` | 统一 IO 清单：输入 / 输出 / IO 区 / 存储 / 内部，带地址与所属变量表（只读） |

面板和工具用的是同一套 Host 实现，面板上的按钮只是把这些操作做成了可视化入口。

## 给 Agent / 调用方的规则（生成能编译的程序）

生成 `.smc2` 时按下面的模型写，别把 Sysmac 的规则搞反：

1. **全局变量表只放普通数据类型**（`BOOL` / `INT` / `REAL` / `TIME` / 数组 / 结构体等）。`TON`、`TOF`、`CTU` 这类功能块实例**只能放程序内部变量**（`scope: "VAR"`）。
2. **程序里用到的每个全局变量，都必须在该程序里再声明一次 `VAR_EXTERNAL`**（同名同类型，`scope: "VAR_EXTERNAL"`）。漏了就会报「未定义的标识符」。
3. **只支持 ST 语言**；不自动做 IO 分配（`AT %IX/%QX`）和任务设置，这两项需要在 Sysmac 里手动做。
4. 生成后带 `compile: true` 跑原厂编译，按返回的错误改；警告一般可忽略。
5. 需要一个真实 `.smc2` 作模板；仓库里的 `examples/AgentPLC_Demo.smc2` 是脱敏最小模板，可直接用来试（它在插件目录里，`plc_sysmac create` 支持把它当模板；不传 `output` 时会写到「文档」目录）。

最小调用示例（双线圈气缸）：

```json
{
  "action": "create",
  "template": "D:\\Desktop\\AgentPLC_Demo.smc2",
  "output": "D:\\Desktop\\Cylinder.smc2",
  "projectName": "Cylinder",
  "variablesMode": "merge",
  "variables": [
    { "name": "伸出按钮", "dataType": "BOOL" },
    { "name": "缩回按钮", "dataType": "BOOL" },
    { "name": "伸出线圈", "dataType": "BOOL" }
  ],
  "newPous": [{
    "name": "PRG_Cylinder",
    "stText": "伸出线圈 := 伸出按钮 AND NOT 缩回按钮;",
    "variables": [
      { "name": "伸出按钮", "dataType": "BOOL", "scope": "VAR_EXTERNAL" },
      { "name": "缩回按钮", "dataType": "BOOL", "scope": "VAR_EXTERNAL" },
      { "name": "伸出线圈", "dataType": "BOOL", "scope": "VAR_EXTERNAL" }
    ]
  }],
  "compile": true
}
```

带定时器的程序把 `TON` 放到 `newPous[].variables` 的 `scope: "VAR"`，不要放进 `variables`（全局表）。

## 安装

详细步骤见文末「部署到你的 DSH agent」。已经装过的话，升级只需覆盖目录后重启 DSH 或在 Plugins 页面重新启用本插件。

## 配置

`cordis.patch.yml` 里的 `agentplc` 行：

```yaml
- insert:
    - id: agentplc
      name: '@local/dsh-agentplc'
      config:
        projectRoots: []          # 扫描目录；留空则不扫描任何目录，在面板里「添加文件夹 / 浏览…」即可
        scanDepth: 8              # 扫描深度（1–12）
        scanLimit: 2000           # 最多列出多少个工程（1–5000）
        tiaDefaultVersion: V16    # 建工程时没写 .ap<版本> 后缀用的版本（本机默认 V16）
```

面板里添加的目录会存到 `%APPDATA%\dsh-agentplc\roots.json`，和上面的 `projectRoots` 合并生效；删除某个目录后，它下面的工程会立刻从列表消失。插件**不预设** Documents / Desktop。

面板只展示**扫描目录内**的工程；`plc_sysmac` 读写工程也要求路径在扫描目录内（唯一例外是随插件附带的 `examples/AgentPLC_Demo.smc2` 模板）。`plc_st convert` 的输入是任意 `.st` 源码路径，`plc_tia` 的工程路径由 Openness 直接打开，这两者不受扫描目录限制。

## 前提与已知限制

**当前能力范围（重要）**：

- ✅ 支持：ST（结构化文本）程序的读取与生成、全局变量表、程序内 `VAR_EXTERNAL` 同步声明、新增 POU（Program / FunctionBlock）、静态校验、Sysmac 原厂编译（F7 + 重编译）；
- ❌ 不支持：**IO 分配**（不会自动写入 `AT %IX/%QX` 地址，需在 Sysmac 里手动分配）、**任务设置**（不能新增/修改任务、周期、优先级）、梯形图/SCL 之外的图形化编辑；
- ❌ 不支持：删除 POU、修改梯形图程序、HMI/轴/IO 硬件配置生成。

- **`.smc2` 格式是逆向出来的**，不是官方格式。当前实现覆盖：`.oem` 实体树、`.manifest`、ST 主体（`StructuredTextModel`）、SLWD 变量表、梯形图 JSON 梯级。生成用的是「模板 + 替换」而不是从零构造，POU 集合和局部变量表沿用模板。
- **TIA Openness 已可用**：V16/V18 与 Openness 程序集齐全，用户已加入 `Siemens TIA Openness` 组并重新登录；首次调用 TIA 时若弹出 Openness 访问授权框，选「全部确定」。`.ap16`/`.ap18` 的生成不依赖 TIA 图形界面，但会启动后台 TIA 实例，单次创建约 20–40 秒。
- **ST 转换需要 Python 3**（本机 `D:\Python\python.exe` 可用）。转换器是 `python/` 下的三个脚本，转换失败会返回完整错误。
- **博途工程目录无法离线解析**：`.ap16/.ap18` 是博途自己的工程库，必须走 Openness。
- 读取全程只读；`export-variables`、`plc_sysmac create`、`plc_st convert`、`plc_tia run` 会写文件或驱动工程。

## 本机验证情况

已验证（用本机真实工程）：

- 侧栏入口与主面板都注册成功（`sidebar.panellist` 的 `agentplc` 占位、`main` 的 `agentplc` 键都是 active）。
- 扫描 `<桌面>`、`<文档>`、`<工程目录>`：79 个条目（62 个 `.smc2`、3 个博途工程、14 个 `.st`）。三个博途工程是 `<桌面>\项目1`（V16）、`<工程目录>\\示例项目V18`（V18）、`<工程目录>\\历史程序\\示例项目`（V16）。
- 博途工程读取：`示例项目V18` 通过面板路由读到 1 个设备（S7-1200 station_1）和 34 个块，耗时 21 秒；`示例项目_弃用` 读到 7 个块（`Main, 气缸块, 点位参数, 夹紧气缸, 夹爪气缸, 升降气缸, 定位气缸`）。
- 解析真实工程：ST 工程 `main_ST` 738 行、`气缸块_ST` 49 行；梯形图工程 `main` 9 段 82 级、`气缸块` 12 级，变量 353 条 / 4 张表。
- 面板路由：`/state`、`/project`、`/pou`、`/variables.csv`、`/st-source`、`/st-xml` 全部 200，CSV 带 BOM 且中文正常。
- `plc_st convert` 用 6 个 `.st` 生成 45680 字节 XML（6 个数据类型、5 个功能块、2 个程序），XML 可被标准解析器解析。
- **`.smc2` 生成链路逐项验证**：以 `<模板工程>.smc2` 为模板，先只重打包（原始内容）→ Sysmac 打开成功；再分别只改名、只换全局变量表、只换 ST 正文、改名+变量+正文组合、改控制器字符串——六个变体全部在 Sysmac Studio 中打开成功。最后用 `plc_sysmac create` 生成 `AgentPLC_输送线示例.smc2`（11 个变量、2 个 POU、中文 ST），Sysmac 窗口标题为 `AgentPLC_输送线示例 - new_Controller_0 - Sysmac Studio (64bit)`。
- **静态校验**：故意写坏的工程报 `2 error(s)`（未声明变量A/B，带行号），正常工程报 `0 error(s)`；`plc_sysmac create` 生成时自动校验，坏样例直接返回 `1 error(s) — 未声明标识符 未声明输出（第 2 行）`；面板路由 `/agentplc/api/sysmac/verify` 返回 200 和问题列表。
- **原厂编译校验**：`plc_sysmac compile` 在提权副本上执行 F7「检查所有程序」+「重编译控制器」（自动确认「所有程序将重新编译，你要继续吗？」→ 是(Y)），从编译窗口读回 `2 error(s), 0 warning(s)` 和两条带 `PRG_Init line 3/4` 的消息；探针实例跑完自动关闭，原工程未改动。
- `plc_tia plan`（create/list/importScl 等）能按工程后缀选中 V16 或 V18 API 并生成命令文件。
- **统一 IO 清单**：`真实工程.smc2` 608 个变量 → 6 输入 / 1 输出 / 601 内部（7 个有地址，EtherCAT 输入输出按对象路径分对）；`现场V18工程` 140 个标签 → 84 输入 / 42 输出 / 14 存储，地址全部识别，标签注释从 Openness 的 `MultilingualText` 正确取文本。面板路由 `/agentplc/api/io` 与 `/agentplc/api/io.csv`（UTF-8 BOM + CRLF）实测 200，CSV 51 KB。另在 20 个真实 `.smc2` 工程上抽检 3873 条有地址变量：`%D` 全部归存储，带 `Input`/`Output` 字样的 ECAT / IOBus / BuiltInIO 地址全部归输入/输出，`MC://_MC_AX` 归 IO 区。
- **非 ASCII SCL 预警**：`plc_tia plan` 发现源文件代码里（注释和字符串除外）有中文标识符时会先给出警告，避免「返回 Success 但块没生成」；纯中文注释不误报（`FB_StarDelta_EN.scl` 不报，`FB_StarDelta.scl` 报）。
- **`.ap18` / `.ap16` 真实生成**：`plc_tia run create` 在本机创建 `AgentPlcDemo.ap18`（V18 API，PLC_1 + 导入 `FB_Conveyor.scl`，编译 `Success`，`list` 读回 `Main, FB_Conveyor`）和 `AgentPlcV16.ap16`（V16 API，PLC_1，编译 `Success`）。
- `plc_tia run importScl` 对已有工程导入 SCL 并编译，返回 `state: Success` 与编译器消息。
- **TIA 编译错误可读**：Openness 的块级消息 `Description` 是空的，但递归子消息带真实错误文本和行号；驱动现在把所属块一路传下去，实测坏工程 `BrokenTest.ap16` 返回 `29 error(s)`，摘要形如 `Error: Tag "DB_SD".Main not defined. [OB_SD (OB123) line 3]`，所以 TIA 也能按真实错误改。
- **TIA 块接口可读**：Openness 对象模型不暴露块接口，所以 `readBlocks` 先把块导出成 Simatic ML，再由 Host 解析 `<Interface><Sections>`；实测 `BrokenTest` 的 `Main`（OB）读出 `Input 2: Initial_Call, Remanence`（含注释），解析器在真实导出上覆盖 FB/FC/OB 的 Input/Output/InOut/Static/Temp/Constant。**不一致（有编译错误）的块 TIA 拒绝导出**，这时会明确返回「先修错误再读」，不会给空接口。
- **内置示例模板**：`plc_sysmac create` 可直接以 `examples/AgentPLC_Demo.smc2` 为模板（不需要把它加进扫描目录），生成的 `PRG_Example` 挂在 `PrimaryTask`，静态校验 `0 error(s)`；面板「新建工程」的模板下拉里也能选到「内置示例」，不填输出路径时写到「文档」目录。
- **ST 转换（本机真实文件）**：`案例工程\01_类型定义.st` 转出 6 个数据类型；面板路由 `/st-source`、`/st-xml`（IEC 61131-10）与 `/st-xml&format=plcopen` 均返回 200，中文路径正常。

未验证（环境或权限不具备）：

- 面板的**实际渲染**：本会话没有浏览器控制，只做了代码级 UI 复核（已按复核意见修掉死路重试、截断说明、下载错误处理、加载态误报、无障碍标签等问题），没有截图。
- **原厂编译每次要一次 UAC**：Sysmac Studio 以管理员权限运行，助手必须提权才能读它的窗口；`plc_sysmac compile` 每次会弹一次 UAC，确认后跑 F7 + 重编译，约 1–2 分钟。
- **编译窗口是自绘界面**：错误行靠 UIA 文本读取（实测能拿到消息、POU、行列），截图 + OCR 仅作兜底；如果某天 OMRON 改版导致 UIA 文本变化，OCR 结果可能不完整。
- **Sysmac Studio 编译生成工程**：生成的 `.smc2` 已确认能在 Sysmac 里打开；也可以直接用 `plc_sysmac compile` 跑原厂编译取证（生成工程里未替换的 POU 可能引用旧变量，编译会如实报出来）。
- **博途下载到真实 PLC / 仿真**：Openness 只做到创建、导入、编译、导出；下载与在线监视不在本插件范围。

## 来源

- `.smc2` 解析思路与 ST 转换器来自本机工作区 `<文档>\deepseek-harness\default-workspace\_脚本\`（`ladder.py`、`st2plcopen.py`、`st2iec61131.py`），转换器已按插件需要包成 `python/convert_st.py`。
- 面板与工具的实现约定见 DSH 插件文档：`sidebar.panellist` 全局面板入口、`main` 面板插槽、Host 侧 `webServer` 只读数据路由。

## 部署到你的 DSH agent

本插件是一个 DSH bundle：装进 DSH 后会在左侧栏出现「PLC 工程台」入口，并注册 5 个工具（`plc_env`、`plc_sysmac`、`plc_st`、`plc_tia`、`plc_io`）。

### 前提

- Windows 10/11；
- 已安装 DSH（桌面版或 Web 版均可）；
- 可选工具链（缺了不挡启动，只是对应功能不可用）：
  - OMRON Sysmac Studio（读/编译 `.smc2`，编译需要管理员权限）；
  - Siemens TIA Portal V16/V18 + Openness 选项，且当前 Windows 用户属于 `Siemens TIA Openness` 组（加入后需重新登录）；
  - Python 3（仅 ST → XML 转换用）。

### 方式一：从 GitHub 安装（推荐）

1. 在 GitHub 仓库页点 **Code → Download ZIP**，解压到任意目录，例如 `D:\tools\agentplc-plugin`；
2. 打开 DSH → **Plugins** 页面 → **添加插件 / install_bundle**，选择解压后的目录（该目录里要有 `package.json` 和 `cordis.patch.yml`）；
3. 启用插件，刷新页面；
4. 左侧栏出现「PLC 工程台」即安装成功。

### 方式二：git clone + 本地联动（开发用）

```powershell
git clone https://github.com/cycle410/PLC-.git D:\tools\agentplc-plugin

# 在 DSH profile 的 package.json 里加依赖并重新安装：
#   "dependencies": { "@local/dsh-agentplc": "link:D:/tools/agentplc-plugin" }
# 然后在 profile 的 cordis.patch.yml 里加 agentplc 行（见下方配置）。
```

### 方式三：打包成 tarball 分发

```powershell
cd D:\tools\agentplc-plugin
npm pack
# 得到 local-dsh-agentplc-<version>.tgz（当前 0.2.0），交给别人
# 对方在 DSH 里 install_bundle，target 指向这个 tgz
```

### 配置

装好后编辑 profile 的 `cordis.patch.yml`，找到 `agentplc` 行：

```yaml
- id: agentplc
  name: "@local/dsh-agentplc"
  config:
    projectRoots: ["D:/Projects", "D:/Documents"]   # 扫描目录，留空 = 不扫描，在面板里添加
    scanDepth: 8                                     # 目录深度（1–12）
    scanLimit: 2000                                  # 最多收录多少项（1–5000）
    tiaDefaultVersion: V16                           # 博途默认版本 V16/V18
  disabled: false
```

改完保存，重启 DSH 或在 Plugins 页面重新启用本插件。

### 验证安装

- 左侧栏有「PLC 工程台」；
- 打开后状态条显示环境检测结果（TIA 版本、Sysmac、Openness 组）；
- 左栏能看到你 `projectRoots` 下的 `.smc2` / 博途工程 / `.st`；
- 点「新建工程」能弹出表单。

### 权限说明

- **Sysmac 原厂编译**（`plc_sysmac compile` 或表单勾选编译）会弹一次 UAC：助手需要管理员权限才能读 Sysmac 的编译窗口；
- **TIA 建工程/编译**首次可能弹 Openness 访问授权，选「全部确定」；
- 插件本身不需要常驻管理员权限。

### 更新与卸载

- 更新：用新版本覆盖插件目录，然后在 Plugins 页面重新启用；
- 卸载：Plugins 页面停用并移除，或从 profile 的 `package.json` / `cordis.patch.yml` 中删掉对应条目。

### 常见问题

- **侧栏没有入口**：确认插件已启用、DSH 已重启；客户端半区需要页面刷新。
- **列表是 0 个工程**：插件默认不扫描任何目录，在面板点「添加文件夹」或「浏览…」选你的工程目录即可；也可以写进 `projectRoots`。
- **编译一直等**：UAC 弹窗需要确认；不确认会在 2 分钟后超时。
- **TIA 报 Openness 安全错误**：把当前用户加入 `Siemens TIA Openness` 组并重新登录。

## 开发与发布检查

```powershell
npm run check                 # 工具 schema 校验
node scripts/check-client.mjs # 面板语法与字典 key 检查
node scripts/smoke-test.mjs   # 不需要模板：schema + 面板 + ST 转换 + README 检查
node scripts/smoke-test.mjs <模板.smc2>  # 额外跑 create → 静态校验 → 新增 POU 全链路
```

`examples/demo.st` 是冒烟测试用的示例 ST 源文件（TYPE + FUNCTION_BLOCK + PROGRAM）。
`<模板.smc2>` 必须是真实可读的 Sysmac 工程（冒烟测试不会上传或修改它，只在临时目录生成副本）。

`examples/AgentPLC_Demo.smc2` 是脱敏的最小示例模板（1 个程序、0 变量）；`smoke-test` 不带参数时会自动用它跑完整链路。
