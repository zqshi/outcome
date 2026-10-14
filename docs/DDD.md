# Outcome 领域驱动设计（DDD）方案

版本 0.2 · 与 [SPEC.md](SPEC.md) v0.3 配套 · 更新：2026-10-14

本文件定义 Outcome 的战略设计（统一语言、子域、限界上下文、上下文映射）与战术设计（聚合、不变量、领域事件、仓储、防腐层），并给出跨上下文一致性、并发幂等与部署映射。运行时行为契约以 SPEC.md 为准，本文件解释"为什么这样切分"以及"实现应如何组织"。

## 1. 目的与范围

- 规定限界上下文边界与依赖方向，使多团队可并行演进而不互相污染模型。
- 规定聚合一致性边界与跨上下文协作方式，避免分布式单体与隐式耦合。
- 与 SPEC 的事件契约、符合性检查逐项对应，保证设计可验证。

非目标：规定具体语言、框架、消息中间件或表结构。

## 2. 统一语言（节选）

| 术语 | 定义 | 标识 | 上下文 |
| --- | --- | --- | --- |
| 任务 | 宿主业务中的一次可验收工作意图 | Task | 任务事实 |
| 尝试 | 一次 Agent 执行，重试产生新尝试，失败投入保留 | Attempt | 任务事实 |
| 成果版本 | 不可覆盖的成果快照或授权引用 | ArtifactVersion | 任务事实 |
| 判定 | 来源授权用户对特定意图/标准/成果版本的验收结论 | Verdict | 任务事实 |
| 基准 | 同业务范围、同质量标准的一份已验收成果的成本/工时参考，发布后不可变 | BaselineVersion | 价值 |
| 可比任务 | 已验收、匹配基准且实际成本完整的任务，是节省计算的唯一输入 | Comparable（规格） | 价值 |
| 报告 | 在截点冻结的范围+公式版本+基准/任务快照 | Report | 价值 |
| 信号 | 观测规则触发的质量异常，可复发、不可改写业务判定 | Signal | 观测 |
| 评测集版本 | 样本+标准+授权的不可变快照 | DatasetVersion | 评测 |
| 独立复核 | 由与提交谱系独立的主体（人或校准过的复核 Agent）核验标注，分歧进入仲裁 | Review | 评测 |
| 实验 | 冻结输入（数据/样本/标准/执行版本）的方案比较 | Experiment | 实验 |
| 在线决策 | 按冻结规则对真实事件做出的抽样与执行决定，未入选也留记录 | OnlineDecision | 在线决策 |
| 作业 | 一次在线评测/执行的可重试运行单元 | Job | 在线决策 |
| 洞察 | 带证据等级（事实/假设/已验证）的改进主张 | Insight | 洞察 |

禁止用语：不以"运行成功/评分通过"指代业务验收；不以"总成本"指代"已记录成本"；不以"提升"指代未冻结对齐的比较结果。

## 3. 战略设计

### 3.1 子域分类

| 子域 | 类型 | 理由 |
| --- | --- | --- |
| 任务事实 | 核心域 | 一切价值归因的锚点；错误即全盘不可信 |
| 价值衡量 | 核心域 | 直接回答商业问题，公式与口径即竞争力 |
| 评测治理 | 核心域 | 独立标签与版本发布是改进可信的前提 |
| 实验 | 核心域 | 冻结对齐决定结论是否成立 |
| 观测处置 | 支撑域 | 发现问题、驱动闭环，复杂度中等 |
| 在线决策 | 支撑域 | 抽样调度与预算控制，参考作业编排模式 |
| 洞察 | 支撑域 | 证据分级与验证状态机 |
| 集成接入 | 支撑域 | 防腐层，隔离宿主差异 |
| 身份与访问 | 通用域 | 成熟问题，采购或复用，不自研差异化 |

### 3.2 限界上下文清单

| 上下文 | 聚合根 | 对外承诺（能力） |
| --- | --- | --- |
| 任务事实 Task Facts | Task | 接收事实、维护生命周期投影、暴露可核验任务视图 |
| 集成接入 Integration | IngestReceipt | 认证、租户绑定、幂等、乱序、回执、对账 |
| 价值衡量 Value | BaselineVersion、Report | 发布基准、计算并冻结报告、解释缺失 |
| 观测处置 Observation | Signal | 触发、分派、调查、独立关闭、复发关联 |
| 评测治理 Evaluation | Dataset、Review | 样本授权、标注/复核分离、版本发布 |
| 实验 Experiment | Experiment | 冻结输入、逐样本比较、结论与独立审核 |
| 在线决策 Online Decision | OnlineRule、Job | 规则版本、抽样决策、执行与重试、结果回流 |
| 洞察 Insight | Insight | 证据核验、验证状态、失效 |
| 身份与访问 Identity | Member、Role、ResourceGrant | 角色配置、数据范围、撤销与审计 |

### 3.3 上下文映射（Context Map）

```text
宿主业务系统 ──(事件/对账)──▶ [集成接入 ACL]
                                   │ 防腐层归一化为领域命令
                                   ▼
                            [任务事实] ──(TaskAccepted/TaskClosed)──▶ [价值衡量]
                                   │                                      │
                                   ├─(异常证据)─▶ [观测处置]               ├─(可比样本)─▶ [实验]
                                   │                │                     │
                                   │                └─(问题样本)─▶ [评测治理]◀─(版本引用)
                                   │                                        ▲
                                   └────────────────────────────────────────┤
                                                              [在线决策]──(回流草稿)
                                                                   ▲
[实验结论/线上复测] ──▶ [洞察] ──(验证请求)──┘
[身份与访问] ──(策略点)──▶ 所有上下文（通用支撑）
```

关系类型：

- 集成接入 → 任务事实：**防腐层（ACL）**，宿主 payload 不得越过归一化直接进入领域。
- 任务事实 → 价值/观测/评测/实验：**客户-供应商**，上游只发布稳定领域事件，不暴露内部模型。
- 在线决策 → 评测治理：**客户-供应商**，只允许产生"待标注草稿"，不写真值。
- 身份与访问：**通用支撑子域**，以策略接口被依赖，禁止反向依赖业务上下文。
- 事件信封 schema：**共享内核（Shared Kernel）**，版本化，变更需全部下游兼容验证。

### 3.4 共享内核与防腐边界

共享内核仅包含：事件信封（SPEC §5）、租户/团队/业务范围标识、TaskRef（tenant + external_id + intent_version）、UTC 时间与金额/币种值对象。任何聚合内部模型（如 Agent 内部状态、Trace span 结构）MUST NOT 进入共享内核。

## 4. 战术设计

通用规则：一个事务只修改一个聚合；聚合间只通过领域事件最终一致；聚合根负责全部不变量校验；跨聚合读取走读模型或显式引用，不做跨聚合 join 写。

### 4.1 任务事实 Task Facts

| 元素 | 内容 |
| --- | --- |
| 聚合根 | Task |
| 实体 | Attempt、ArtifactVersion、Verdict、CostEntry（纠错留链） |
| 值对象 | ExternalKey、IntentVersion、StandardRef、Money、Duration、EvidenceRef |
| 关键不变量 | 外部键在来源租户内唯一；业务状态仅宿主授权事件可变；重试新增 Attempt 且失败投入保留；成果版本只追加；Verdict 必须匹配意图/标准/成果版本；质量评分不得写入业务状态 |
| 领域事件 | TaskCreated、AttemptRecorded、ArtifactPublished、UserVerdictIssued、TaskStatusChanged、CostRecorded、CostCorrected |
| 仓储 | TaskRepository（聚合整体加载/保存，乐观并发 version） |

设计说明：Task 是唯一写入口；CostEntry 的纠错以新记录替换并保留旧记录（局部事件溯源），不支持就地覆盖。

### 4.2 集成接入 Integration

| 元素 | 内容 |
| --- | --- |
| 聚合根 | IngestReceipt（幂等键 = event_id + payload 摘要） |
| 实体 | SourceEvent（原始信封存档） |
| 值对象 | SchemaVersion、IdempotencyKey、GapRange、ErrorCategory |
| 关键不变量 | 同键同摘要只提交一次；同键不同摘要隔离为冲突；版本缺口隔离等待补拉；成功回执在持久提交后返回 |
| 领域事件 | EventAccepted、EventDuplicated、EventRejected、EventQuarantined、GapDetected、GapResolved |
| 仓储 | ReceiptRepository、SourceEventRepository |

职责边界：本上下文不做业务解释，只做归一化与投递；对账读取（fetch 操作）与凭据隔离见 SPEC §12。

### 4.3 价值衡量 Value

| 元素 | 内容 |
| --- | --- |
| 聚合根 | BaselineVersion（发布后不可变）、Report（截点冻结） |
| 实体 | BaselineDraft、CostAccount（已知成本归集视图） |
| 值对象 | ScopeKey、QualityStandardRef、UnitOfOutcome、Rate、Currency、FormulaVersion、Cutoff |
| 关键不变量 | 未知不补零、零基准不计算率；基准发布只追加且按适用时间生效；新发布基准影响当前分析但不改已冻结报告；币种/单位/质量不匹配不得比较；报告必须携带范围、公式版本与证据引用 |
| 领域事件 | BaselinePublished、BaselineDeprecated、ReportFrozen、ReportInvalidated |
| 仓储 | BaselineRepository、ReportRepository |
| 领域服务 | ComparableSelection（可比任务规格求值）、SavingComputation（公式版本化计算）、CoverageAssessment（缺失原因分类） |

可比任务规格（Specification）：`已验收 ∧ 匹配基准 ∧ 实际成本完整 ∧ 同业务范围 ∧ 同质量标准`。规格版本随报告冻结，后续口径变化不改历史。

### 4.4 观测处置 Observation

| 元素 | 内容 |
| --- | --- |
| 聚合根 | Signal |
| 实体 | InvestigationRecord |
| 值对象 | SignalSource、RuleVersion、Owner、DueAt、Disposition |
| 状态机 | 待调查 → 调查中 → 待复核 → 已关闭；待复核可退回调查 |
| 关键不变量 | 处置不修改业务判定；提交人不得自行复核关闭；关闭后复发创建新 Signal 并引用原记录 |
| 领域事件 | SignalRaised、SignalAssigned、InvestigationUpdated、SignalClosed、SignalRecurred |

### 4.5 评测治理 Evaluation

| 元素 | 内容 |
| --- | --- |
| 聚合根 | Dataset（可变元数据）、Review（标注复核流程） |
| 实体 | Sample、LabelSubmission、ReviewAssignment、Arbitration、ReviewerProfile（谱系、校准状态、问责主体） |
| 值对象 | SampleSource（任务/尝试/标准/意图版本四元组）、Authorization、RubricRef、LineageRef、CalibrationScore |
| 关键不变量 | 提交与复核主体谱系不同；复核主体 MUST 满足资格（谱系隔离、可问责身份、金标准校准有效、抗女巫克隆、防注入——无真值写入与状态变更权限）；未校准克隆不计入独立标签；分歧由第三方仲裁；样本授权、去重、独立标签齐备且记录人工核验抽样覆盖率后才允许发布 DatasetVersion；历史版本样本只读；同任务族不得同时泄漏到对照与保留测试；草稿变化使旧标签证据失效 |
| 领域事件 | LabelSubmitted、ReviewAssigned、ReviewCompleted、ReviewerCalibrated、ArbitrationDecided、DatasetVersionPublished |
| 仓储 | DatasetRepository、ReviewRepository、DatasetVersionRepository（不可变存储）、ReviewerRepository |

### 4.6 实验 Experiment

| 元素 | 内容 |
| --- | --- |
| 聚合根 | Experiment |
| 实体 | SampleResult、RunAttempt（执行重试） |
| 值对象 | DataRef、EvalRef、Budget、AgentVersion、CompatibilityReport |
| 关键不变量 | 冻结后输入（数据/样本/标准/执行版本）不可修改；同输入同标准才允许逐样本比较与排名；不兼容只允许描述性并列并标注差异；小样本不得宣称稳定结论；结论须独立审核 |
| 领域事件 | ExperimentCreated、ExperimentFrozen、SampleExecuted、ExperimentConcluded、ConclusionReviewed、ExperimentInvalidated |

### 4.7 在线决策 Online Decision

| 元素 | 内容 |
| --- | --- |
| 聚合根 | OnlineRule（版本化）、Job |
| 实体 | Decision、JobAttempt、BudgetLedger、Trace（可选） |
| 值对象 | IdempotencyKey、SelectionProbability、Threshold、BudgetLimit、RetryPolicy |
| 作业认领状态 | Unclaimed → Claimed → Running →（Succeeded / Failed / TimedOut / CanceledByReconciliation）；失败进入 RetryQueued 后回 Claimed（与任务业务状态严格分离，见 SPEC §13） |
| 关键不变量 | 未入选也必须留决策记录；未知概率不得当总体随机样本；预算超限进入"预算限流"并保留已投入；回流只产生待标注草稿；风险样本均值不得代表总体 |
| 领域事件 | RulePublished、DecisionRecorded、JobDispatched、JobSucceeded、JobFailed、JobRetrying、BudgetExceeded、ResultRecycled |
| 仓储 | RuleRepository、JobRepository、DecisionRepository |

### 4.8 洞察 Insight

| 元素 | 内容 |
| --- | --- |
| 聚合根 | Insight |
| 值对象 | EvidenceRef、EvidenceLevel（事实/假设/已验证）、ValidationPlan |
| 状态机 | 候选 → 证据核验 → 待验证 → 验证中 → 已验证 / 未支持 / 已失效 |
| 关键不变量 | 证据缺失或过期不得显示为已验证；相关性不得写为因果；标准或来源变更后重新评估适用性；自然语言摘要不得补造数字 |

### 4.9 身份与访问 Identity

| 元素 | 内容 |
| --- | --- |
| 聚合根 | Role、ResourceGrant；Member 为实体 |
| 值对象 | Action（如 quality.review.assign）、Scope（租户/团队/业务范围） |
| 关键不变量 | 服务端在每次读写/导出/后台作业/内容引用处校验；管理员不自动拥有宿主验收权；最后管理员保护；撤销即刻生效 |

## 5. 跨上下文协作与最终一致性

| 发起方 | 事件 | 消费方 | 一致性 | 失败处理 |
| --- | --- | --- | --- | --- |
| 任务事实 | UserVerdictIssued / TaskStatusChanged | 价值、在线决策 | 最终一致 | 消费侧幂等重试；缺口补拉后计算 |
| 任务事实 | AttemptRecorded（含投入） | 价值、成本归集 | 最终一致 | 成本缺失标 unknown，不补零 |
| 观测处置 | SignalRaised | 评测（样本回流）、实验（排除列表） | 最终一致 | 回流失败留重试队列 |
| 在线决策 | ResultRecycled | 评测（待标注草稿） | 最终一致 | 草稿重复按来源四元组去重 |
| 实验 | ConclusionReviewed | 洞察 | 最终一致 | 洞察侧保留"未验证"降级 |
| 集成接入 | EventAccepted | 任务事实 | 同步（同进程命令） | 失败即回执失败，不半提交 |

规则：消费方 MUST 幂等（以 event_id 或业务自然键）；任何跨上下文写操作禁止直接调用对方仓储；禁止分布式事务，以"本地事务 + 事件 + 对账"替代。

## 6. 一致性、并发与幂等

- 聚合保存携带乐观并发版本号，冲突返回可重试错误并审计。
- 事件信封携带 aggregate_sequence；同一聚合乱序到达时隔离等待补拉，不静默覆盖。
- 命令入口以 IdempotencyKey 去重；重放（replay）复用原键，不产生重复事实、成本与判定。
- 局部事件溯源范围仅限：Verdict 纠错链、CostEntry 纠错链、Job 状态迁移历史；其余聚合采用当前状态 + 审计日志。
- 时钟：服务端统一 UTC；所有截止/有效期比较使用服务端时钟，禁止用客户端时间参与调度判断。

## 7. 防腐层与适配器设计

| 适配器 | 方向 | 归一化职责 | 凭据要求 |
| --- | --- | --- | --- |
| 宿主业务适配 | 入 | payload → 领域命令；状态/标签/优先级归一化（trim+lowercase）；外部键映射 | 凭据仅服务端；对账读取走同一凭据 |
| 账单适配 | 入 | 账单条目 → CostEntry（区分估算/结算；类别去重） | 只读密钥，最小权限 |
| 身份适配 | 入 | 外部 IdP 身份 → Member/Role 绑定；租户来自服务端认证来源 | 不信任浏览器提交的租户字段 |
| Agent 执行适配 | 出 | 执行框架事件 → Attempt/Trace；执行结果不得写业务判定 | 执行子进程 MUST NOT 继承宿主/账单凭据环境变量 |

每个适配器必须发布 profile 文档：支持的 scope、必填/可选字段、错误分类（auth_failed / rate_limited / timeout / transport / malformed_payload / scope_denied）、限流与分页行为、需从子进程环境剔除的变量名。错误必须可归类为稳定 category + 可读 message，核心逻辑只区分成功/失败与分类。

## 8. 领域事件与消息设计

事件信封字段见 SPEC §5（event_id、schema_version、source、external_task_id、aggregate_sequence、occurred_at、身份、任务关联）。补充演进规则：

- 加可选字段 = 兼容变更；改语义/删字段 = 主版本升级，下游在窗口期内双读。
- 事件是事实回放记录，MUST NOT 被消费方"修改"；修正以新事件表达。
- 每个事件 MUST 可追溯到来源聚合与接收回执，支持对账与审计。

## 9. 仓储与持久化映射

| 聚合 | 仓储 | 存储形态 | 读模型 |
| --- | --- | --- | --- |
| Task | TaskRepository | 当前状态 + 事件归档 | 任务台账、详情下钻 |
| IngestReceipt | ReceiptRepository | 只增 + 冲突隔离区 | 对账面板 |
| BaselineVersion / Report | Baseline/ReportRepository | 不可变对象存储 | 分析页、报告页 |
| Signal | SignalRepository | 状态机 + 记录链 | 待办、观测页 |
| Dataset / DatasetVersion | DatasetRepository | 可变头 + 不可变版本 | 评测集、样本队列 |
| Experiment | ExperimentRepository | 冻结快照 + 逐样本结果 | 实验详情、比较页 |
| OnlineRule / Job | Rule/JobRepository | 版本 + 作业状态机 | 在线评测、队列 |
| Insight | InsightRepository | 状态机 + 证据引用 | 洞察列表 |
| Role/ResourceGrant | AccessRepository | 配置 + 审计 | 角色配置下钻 |

读模型允许冗余投影，但投影 MUST 可由聚合重建；投影滞后必须在界面标注"过期数据"状态（SPEC §9）。

## 10. 依赖方向与部署形态

推荐模块化单体 + 端口-适配器（Hexagonal）：

```text
interfaces/（页面、API、事件入口）
        │ 依赖
application/（用例编排、事务边界=单聚合、领域事件发布）
        │ 依赖
domain/（聚合、值对象、规格、领域服务——零外部依赖）
        ▲
infrastructure/（仓储实现、适配器、队列、时钟、ID 生成）──实现──▶ domain 端口
```

- domain 不 import infrastructure；跨上下文只依赖对方 application 暴露的事件/接口。
- 不先建分布式调度；作业调度与对账以单进程权威状态起步（SPEC §13），可水平扩展的前提是分派权单一与幂等。
- 每个上下文对应一个模块目录与独立 schema 前缀，为后续拆分服务保留路径。

## 11. 与原型及验证的映射

| 上下文 | 原型承载 | 验证脚本 | 符合性检查（SPEC §11 / §17） |
| --- | --- | --- | --- |
| 任务事实 | index.html 任务台账/详情 | verify-integrated | TC-01、TC-02、TC-03 |
| 价值衡量 | 生产力与成本分析 | verify-integrated、verify-management | TC-05、TC-06、TC-07、TC-08 |
| 观测处置 | 任务观测、信号处置 | verify-management | TC-12 |
| 评测治理 | 评测集、独立复核 | verify-quality-governance、verify-quality-ux | TC-04、TC-10 |
| 实验 | 实验与对比 | verify-quality-governance | TC-09 |
| 在线决策 | 在线评测、队列 | verify-online | TC-11、TC-22 |
| 身份与访问 | 角色权限配置 | verify-management-upgrade | TC-13 |
| 集成接入 | 企业集成 | verify-integrated | TC-01、TC-15、TC-19 |

## 12. 设计决策记录（摘要）

1. **业务状态不归领域可变**：验收权在宿主，领域内改状态会制造第二个权威来源；故 Task 状态只接受宿主授权事件。
2. **报告冻结而非实时计算**：后续基准/数据变化会使实时口径漂移；冻结截点+公式版本保证结论可复核（对称 Symphony 的"仓库内策略版本化"思想：口径与证据随版本走）。
3. **调度状态与业务状态分离**：在线 Job 的 Unclaimed/Claimed/Running/RetryQueued 是运行时认领状态，与 Task 业务状态互不写入（借鉴 Symphony 编排状态机设计：先对账、再分派、单一权威调度）。
4. **回流不产生真值**：在线结果只进待标注草稿，防止自动评分污染独立标签链。
5. **不做全量事件溯源**：仅纠错链与作业迁移历史需要回放，其余用当前状态+审计，控制存储与复杂度。
6. **调度重启可重建**：调度权威状态允许内存态，恢复依赖宿主对账+已记录作业；但已确认事件、成本与判定 MUST 持久（比 Symphony 更强的恢复承诺，因为 Outcome 记录经营事实）。
7. **制衡约束谱系，不约束物种**：独立复核要防的是自证与利益重合，不是"人不够多"。故 Review 约束的是执行谱系隔离、校准与问责身份；Agent 可作为复核主体规模化承担初审，人收敛为金标准维护者、校准审计者、仲裁者与残余风险问责人；高风险与发布门禁强制保留人工路径。
