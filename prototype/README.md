# Outcome 交互参考原型

原型用于展示 Outcome 规范中的页面结构、业务流程与指标口径。

## 运行

在浏览器打开根目录的 [index.html](../index.html)，无需构建或联网。

支持任务台账、Agent 资产、生产力分析、基准成本、评测集、实验比较、独立复核、在线评测、任务观测、企业集成和角色权限配置。

## 能力边界

数据保存在浏览器本地。身份切换、连接状态、评测执行和队列推进包含模拟行为。原型不提供生产认证、网络连接器或后台执行服务。

`index.html` 内联运行模块，是原型入口。根目录的 `quality-*-module.js` 为独立模块样例，不是 HTML 的运行依赖。

## 验证

需要 Node.js：

```sh
node scripts/verify-integrated.cjs
node scripts/verify-ux-integrated.cjs
```

真实浏览器检查需要 Chrome 与 Playwright：

```sh
node scripts/verify-browser.cjs
```

验证结果只适用于所执行的原型场景，不代表生产实现符合性。
