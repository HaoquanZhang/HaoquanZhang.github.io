# English chat extension

本目录为原感叹号实验的独立英文补充，不修改原网页或原结果。

60 道英文聊天题：原中文 30 题的英文改写，加上 30 道新编英文题。六类各 10 题。题目均不含 ! 或 ！，不指定标点风格。不是标准公开 benchmark，也不是 MT-Bench 新题。英文与中文并非由独立译者审校的严格平行语料。

沿用原 11 个模型服务、仅 user 消息、temperature=1、默认 max_tokens=4096、单次采样。初始并发 12；技术不完整最多三次尝试，后续 token 上限 8192 / 16384；content_filter 不重试。不因标点数量重试。

run_bench.py、analyze.py、test_scoring.py 与原实验逐字一致，SHA-256 保存在 experiment_plan.json。只计最终 content，不计 reasoning；清洗代码块、行内代码、URL 和部分 Markdown 控制符，保留自然语言引文。合并半角/全角感叹号，其他标点分别计数；密度以非空白 Unicode 字符为分母。共同题目口径要求所有 11 个模型都取得完整可计数回答，失败不计作零。Wilson 与 10,000 次配对 bootstrap 沿用原实现。

新增 15 美元派发上限；包含在途请求可能继续产生的用量，不是账单硬上限。用量估算忽略缓存折扣，错误预留输出上限，并加 25% 余量；结束后独立核对网页账户用量。

数据来源：http://vlmeval.byted.org/?tab=model_proxy_hub
原实验、原中文题目与原英文 MT-Bench 子集：../exclamation-bench/

题集在请求前冻结，见 experiment_plan.json。新增英文题集结果须与原 MT-Bench 子集分开报告；不能把两组任务的差异全部归因于语言。

## 运行与分析

凭据放在交付目录外的临时文件，通过 --key-file 读取，结束后删除；不写入任何结果文件。首次运行前，usage_snapshots.jsonl 必须保存本次实验的独立账户用量基线，不能沿用旧实验的首条基线。

```bash
python3 run_bench.py --key-file /path/to/key --usage-mode estimate --workers 12 --request-timeout 150
python3 run_bench.py --key-file /path/to/key --usage-mode estimate --retry-incomplete --max-tokens 8192 --workers 8 --request-timeout 300
python3 run_bench.py --key-file /path/to/key --usage-mode estimate --retry-incomplete --max-tokens 16384 --workers 8 --request-timeout 300
python3 analyze_extension.py
python3 validate_results.py
python3 write_results.py
```

最后两步生成审计、文字结果与压缩包，不生成网页。中英配对补充分析从父目录读取旧中文回答，联合英文统计从父目录读取旧 MT-Bench 英文回答；父数据的哈希也会校验。此次新增 API 请求只针对 prompts.jsonl 内的 60 道英文题。
