
# 项目依赖

首先 通过 clone或者 直接拉zip压缩包 把项目代码拉到本地
项目地址： https://github.com/Garril/Forge
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808084743.png)

案例通过 **codebuddy** 运行，新环境安装
codebuddy官网： https://www.codebuddy.cn/home/

codebuddy打开项目文件夹

## npm

用于安装项目依赖


**建议：右键 setup-forge.cmd文件，以管理员的身份运行，更好**
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/e969ab68b8cef4a0f2596419dd7ea1e2.png)
**setup-forge.cmd** 用于检测电脑是否安装npm工具，没有会安装
如果电脑已经有npm，则会直接跳过，然后自动安装项目依赖 **就是那些node_modules**

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/5aa96fa2ca3e0f471d313db36598b841.png)

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/8ab3a5389d4078526e61e237aba02280.png)

>安装完成后，最好重启一下codebuddy
>不然后续启动项目需要运行  npm start，但npm系统识别不出

**重启后，查询安装的版本**，有结果就行

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/f3ac77dde2d770845bcc66645a697a8c.png)

## mysql

数据库，没有数据库的需要下载
下载地址： https://dev.mysql.com/downloads/file/?id=556533
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/7bf0b6460c7973b4c6eba78f2dbb9f46.png)

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/38ccafcfb60cb1a5d67375b1bb93fa3a.png)
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/488743b5a379c9779f53f20a5e23a324.png)

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/721108ea0626342c205d0bcf9b4f07dc.png)

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/c33e8c5e24020c06b5437dc1dbeb2e3f.png)

>codebuddy安装数据库插件

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/2d4f4ff1b049c03300ba3312974d47c2.png)

>连接本地数据库

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/8bbdf90739ef9d19c0b5aeea397a8577.png)
**暂时看不到，是正常的**
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808085754.png)


## python

用于安装项目依赖，后续一些数据的处理，建议让ai使用python，相较项目框架的js语言，有天然的优势。

**建议：鼠标右键 setup-python.cmd文件，以管理员的身份运行，更好**
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/8ca834133d09bf256bc20583da8f11a8.png)
运行脚本安装python
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/91dce79ec37e850ceabbeeb229ccb587.png)

# 启动

>启动前需要查看 数据库密码，代码默认写的是123456
>如果之前安装自己改了，那么需要改

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/8a457a8f8e6ede42161a26401aee50e3.png)
最后
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/a47d8aa879f072294357a94b7c4c914c.png)



# 项目的使用

### 盘面分析

#### 安装

启动mt5，登陆就行
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808090210.png)

右上角显示 **已连接**，就ok
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808090113.png)

我所使用的mt5安装包如下（TMGM下载的）：其他的没测试过
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808090418.png)


#### 自定义指标

原先的想法是copy，tradingview的指标代码，然后直接这边显示
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808090843.png)
我试了两个，发现要**做一个通用性强的，太麻烦**，我自己用的不多，留一个Bar Count，其他的需要输入代码还得让ai去调，目前的指标，比如：**ICT/SMC**也是ai实现，不对得调

### K线结构录入和扫描

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808103827.png)

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808104445.png)
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808104632.png)
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808104803.png)

### ai分析

一样的配置API，然后点击分析行情即可
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808105146.png)
**这里做的很粗糙，可以自己完善**

#### ai分析的原理

底部“AI 盘面分析”不是只把当前一根 K 线发送给 AI，而是整理了当前品种的行情、多个周期数据、指标计算结果和结构匹配结果后统一发送。

点击“分析当前行情”后，系统会收集当前品种的多维度行情数据，并发送给配置的 AI 模型进行分析。

##### 1. 当前品种和当前周期

系统会提供：

- 当前交易品种，例如 `XAUUSD`；
- 当前选择的周期，例如 `M15`；
- 当前最新价格；
- Bid 价格；
- Ask 价格；
- 当前点差；
- 行情会话状态。

当前周期会使用已加载的历史 K 线数据，最多取最近约 **150 根 K 线**用于指标和结构分析。

---

##### 2. 多周期 K 线数据

AI 会同时参考以下周期：

- 当前选择的周期；
- 15 分钟；
- 1 小时；
- 4 小时；
- 1 天。

如果当前周期本身就是其中一个周期，系统不会重复请求，而是复用当前已经加载的数据。

每个周期最多使用最近约 **150 根 K 线**，并提取：

- 开盘价；
- 最高价；
- 最低价；
- 收盘价；
- 成交量；
- K 线数量；
- 当前周期的最新一根 K 线；
- 该周期整体价格方向。

---

##### 3. 趋势数据

系统会根据每个周期的 K 线计算价格趋势：

- 上涨；
- 下跌；
- 横盘。

趋势主要通过该周期首尾 K 线的收盘价变化进行判断，用于辅助 AI 分析不同周期之间是否同向或出现冲突。

---

##### 4. 技术指标数据

系统会把当前启用的技术指标计算结果提供给 AI，主要包括：

>EMA

根据用户在“指标管理”中启用的 EMA 周期，提供：

- EMA 周期；
- 最新 EMA 数值；
- 当前价格与 EMA 的关系。

>布林带

提供最新的布林带数据，包括：

- 中轨；
- 上轨；
- 下轨；
- 当前价格在布林带中的位置。

>MACD

提供最新的：

- MACD 值；
- Signal 值；
- Histogram 柱值。

---

##### 5. ICT / SMC 结构数据

系统会先根据行情 K 线计算 ICT / SMC 相关结构，再将确认后的结果提供给 AI，包括：

- 市场结构；
- BOS 或 CHOCH；
- 流动性位置；
- 流动性是否被扫；
- FVG 区域；
- OB 区域；
- 区域当前状态；
- 溢价区或折价区；
- 系统生成的结构摘要。

AI 会优先使用系统已经计算出的结构，不会在没有数据依据时自行编造 BOS、CHOCH、FVG 或 OB。

---

##### 6. 预设 K 线结构匹配结果

系统会把当前行情与用户保存的 K 线结构进行匹配，并提供最近的匹配结果，包括：

- 匹配到的结构名称；
- 匹配发生的时间；
- 是否属于自动生成的镜像结构。

当前结果最多提供最近约 **12 条匹配记录**。

---

##### 7. 扫描结果

如果用户之前执行过“扫描自选品种”或“扫描其他品种”，AI 还会收到扫描结果摘要，包括：

- 品种；
- 周期；
- 匹配数量；
- 最近一次匹配时间。

如果没有执行扫描，扫描结果为空，不会影响其他数据分析。

---

##### 8. AI 不会使用的数据

AI 盘面分析不会自动获取或使用：

- 新闻；
- 财经日历；
- 基本面数据；
- 其他网站实时资讯；
- 用户账户密码；
- 用户交易指令；
- 未发送给 AI 的历史数据。

该功能只根据系统整理后的行情上下文进行只读分析，不会自动执行交易。
**如果后续要自动执行，也很方便，本身已经连接mt5了**


### K 线结构匹配规则

**目前的匹配规则不够完善，刚实现不久，很多时候就是偏差大了，结构不对，偏差小了，匹配不到，还在想是否有更优的做法，直接炼模型还是 更加细化匹配规则。。。。。。未知**

#### 1. 录入结构

用户可以在结构录入画布中绘制一组 K 线。每根 K 线包含：

- 开盘价；
- 收盘价；
- 最高价；
- 最低价。

同时可以设置：

- 结构名称；
- 结构前的趋势；
- 结构后的趋势；
- 观察趋势的 K 线数量；
- 允许的形态偏差值。

系统不要求录入价格必须和实际行情价格一致。例如，录入时可以使用 `100` 附近的价格，实际行情即使在 `3000` 或 `100000` 附近，也可以进行匹配。

---

#### 2. 系统提取 K 线形态特征

保存结构后，系统会把每根 K 线转换成相对形态，而不是保存绝对价格。

主要分析以下内容：

- K 线是阳线还是阴线；
- 实体占整根 K 线高度的比例；
- 上影线占整根 K 线高度的比例；
- 下影线占整根 K 线高度的比例；
- 收盘价位于整根 K 线什么位置。

这样做的目的是比较 K 线的形状，而不是比较具体价格。

例如：

- 录入结构中的 K 线实体占整体高度约一半；
- 行情中的某根 K 线实体也占整体高度约一半；

即使两者价格完全不同，系统仍然认为它们的形态可能相似。

---

#### 3. 分析多根 K 线之间的关系

对于由多根 K 线组成的结构，系统还会分析 K 线之间的关系，例如：

- 哪一根 K 线的实体更大或更小；
- 是否存在实体吞没；
- 各根 K 线的低点是逐步抬高还是逐步降低；
- 相邻 K 线之间是否符合录入时的排列关系。

因此，系统不是只判断每根 K 线是否相似，还会判断整组 K 线的排列关系是否一致。

---

#### 4. 使用连续 K 线进行匹配

系统会在行情中连续截取与预设结构相同数量的 K 线进行比较。

例如，预设结构包含 3 根 K 线，系统会依次检查：

```text
第 1～3 根 K 线
第 2～4 根 K 线
第 3～5 根 K 线
第 4～6 根 K 线
……
```

每一组连续 K 线都会与预设结构进行比较。

---

#### 5. 允许一定形态偏差

实际行情中的 K 线不可能和手动画出的结构完全一致，因此系统允许一定误差。

默认允许偏差值为：

```text
0.18
```

允许偏差主要应用于：

- 实体比例；
- 上影线比例；
- 下影线比例；
- 收盘价位置。

例如，预设结构中某项比例为 `0.50`，实际行情中该比例在允许范围内接近 `0.50`，就可能通过这一项检查。

偏差值越小：

- 匹配越严格；
- 匹配结果越少；
- 误报相对较少。

偏差值越大：

- 匹配越宽松；
- 匹配结果越多；
- 可能出现更多相似但不完全相同的结果。

---

#### 6. 检查结构前后的趋势

用户可以为预设结构设置：

- 结构前趋势：上涨、下跌或不限制；
- 结构后趋势：上涨、下跌或不限制；
- 趋势观察数量。

例如，设置为：

```text
结构前趋势：下跌
观察数量：8 根 K 线
```

系统会检查结构出现之前的 8 根 K 线：

- 如果这段时间的整体收盘价下降，则认为符合下跌趋势；
- 如果没有足够的历史 K 线，则不认为符合；
- 如果选择“不限制”，则跳过这项检查。

结构后的趋势判断方式相同。

---

#### 7. 自动检查反向结构

每个预设结构都会自动生成一个反向结构，系统会同时匹配两种情况：

1. 原始结构；
2. 反向结构。

反向结构会进行以下转换：

- K 线顺序反转；
- 上下价格关系反转；
- 阳线和阴线方向相应反转；
- 结构前后的趋势条件相应调整；
- K 线之间的关系重新计算。

因此，用户只需要录入一个方向的结构，系统也可以识别其相反方向的类似形态。

---

#### 8. 当前图表中的匹配

在当前品种和周期下，系统会使用已经加载的行情 K 线进行扫描。

只有满足以下条件的连续 K 线，才会被认为匹配成功：

1. K 线数量一致；
2. 每根 K 线的阴阳方向一致；
3. 实体和影线比例在允许偏差范围内；
4. 收盘价位置相近；
5. K 线之间的排列关系一致；
6. 结构前后的趋势条件符合；
7. 原始结构或反向结构匹配成功。

匹配成功后，系统会在图表上标记该结构，并显示对应的结构名称。

---

#### 9. 扫描其他品种和周期

使用“扫描自选品种”或“扫描其他品种”时，系统会：

1. 获取指定品种的历史 K 线；
2. 分别检查多个周期；
3. 使用结构库中所有已启用的预设；
4. 同时检查原始结构和反向结构；
5. 汇总每个品种、每个周期的匹配结果。

当前默认扫描周期为：

```text
1 分钟、5 分钟、15 分钟、1 小时
```

默认每个品种和周期扫描最近：

```text
200 根 K 线
```

最少扫描：

```text
120 根 K 线
```

扫描结果会显示：

- 品种；
- 周期；
- 匹配数量；
- 最近一次匹配的位置。

点击扫描结果后，系统会切换到对应品种和周期，并定位到最近一次匹配位置。

---

#### 10. 结果说明

图表中的结构标记表示：

- 黄色标记：匹配到原始结构；
- 紫色标记：匹配到反向结构；
- 标记所在的 K 线：该结构的最后一根 K 线；
- 标记文字：匹配到的结构名称。

需要注意，结构匹配属于形态识别功能，只表示当前行情与预设形态相似，并不代表未来行情一定按照预设方向运行。



## 视频总结

### cookie配置和ai-api配置

输入网址，解析视频、下载视频、视频转SRT字幕带时间戳、再丢给ai总结笔记

>使用之前需要配置文件

使用页面拓展工具： https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808091841.png)
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808092024.png)

下载下来的文本文件类似如下：
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808092148.png)
bilbil就改个名字换掉 cookies_bilbil.txt
文件路径在：Forge\video-captioner\cookies_bilbil.txt



youtube同理，一样的流程，需要就去youtube拿

**依赖需要python**
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808092758.png)
如果点击后，按钮还是“检测/初始化”，提示：“无法连接后端，请先启动 Forge Server”
大概率是 ffmpeg安装有问题，（部分指令需要管理员身份运行）解决方法：
“找到setup-python.cmd ---> 右键 ---> 以管理员身份运行”
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/image.png)



![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808092900.png)

商汤deepseek v4-flash试用教程 链接: https://pan.baidu.com/s/1hGK41LVWXIi622PuRtKL_w?pwd=pqew 提取码: pqew 

一般这两种调用方法，你填一下 **baseURL**和**api-key**，应该可以直接调，不行就让丢文档进入，让ai兼容下新的方法

查余额目前只支持 deepseek官方的（有提供接口）
**使用新的api之前，记得刷新一下模型**



### 使用

案例如图： 网址使用的是 https://www.bilibili.com/video/BV1Jz4y1G7Wt/?spm_id_from=333.1387.favlist.content.click&vd_source=1d1a475d9fda02b464d2e04d552b6c55

![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808091542.png)

后续只需要下载视频就点**下载视频**
要全流程自动生成笔记，就点 **自动生成笔记**
![图片](https://forupload.oss-cn-guangzhou.aliyuncs.com/img/Pasted%20image%2020260808092525.png)
后续可以自己用ai 进一步开发，直接把视频内容总结成一张图

