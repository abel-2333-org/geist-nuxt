# 生成文字语言反例字体

`locale.ttf` 是本测试自制的最小 OpenType 字体，只有空白与两个矩形字形；没有第三方字体素材或生产用途。`generate.py` 使用 fontTools 的 FontBuilder/feaLib 生成它，运行测试只读已提交字体，不需要 Python。

`*` 在默认语言和 `tr` 下的 advance 都为 500 units，垂直 metrics 相同；`locl` 的 TRK 分支把矩形换成超出 advance 的字形。字号 20px 时，默认 ink 的 right 为 8px，`tr` 为 50px。该差异证明只比较 CDP/Canvas 的 advance 与行高不足以建立 ink 外包围，必须将 Canvas.lang 对齐真实 DOM/CSS locale。

`tests/browser/generated-paint.spec.ts` 读取此字体为 data URL，只注入隔离控制页面，验证英语分离、土耳其语覆盖、恢复英语与移除生成内容。字体、生成源与说明均在 contrastSource 摘要范围内，不进入 registry 或正常 gallery。

如需再生成，在已有包含 fontTools 的 Python 环境运行 `python generate.py`。字体构建时间元数据可能不同，应以实际生成文件作为新 evidence digest 的组成部分。
