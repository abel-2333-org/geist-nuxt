// Real request/response fields from Onerway `POST /v1/txn/doTransaction`,
// transcribed from the consumer's OpenAPI document (issue #117 review).
//
// Why this fixture exists: the synthetic matrix was built on the assumption
// that JSON-encoded content is the RARE case and an array is the common one.
// This endpoint says the opposite — 11 of its structured fields are
// `type: string` + `x-onerway-format: json_string`, and NOTHING is a plain
// object. Any chrome that marks encoding as exceptional would mark almost
// every row here, so the disclosure decision has to be judged on this shape,
// not on the matrix.
//
// Descriptions are trimmed for the playground; requiredness, conditions,
// constraints and nesting are faithful to the source document.
import type { ValueBearingField } from '../model/field-value'

/** Shared billing/shipping contact shape (spec repeats it verbatim). */
function contactFields(prefix: string): ValueBearingField[] {
  return [
    { path: `${prefix}_firstName`, name: 'firstName', type: 'string', description: '客户名字。' },
    { path: `${prefix}_lastName`, name: 'lastName', type: 'string', description: '客户姓氏。' },
    {
      path: `${prefix}_phoneCountryCode`,
      name: 'phoneCountryCode',
      type: 'string',
      description: '客户电话号码的国家拨号码，纯数字、不含 `+`；与 `phone` 组合为完整号码。',
      condition: '使用 MB Way 本地支付方式时必填。',
    },
    {
      path: `${prefix}_email`,
      name: 'email',
      type: 'string',
      required: true,
      description: '客户邮箱地址，用于交易确认和争议处理。',
    },
    {
      path: `${prefix}_country`,
      name: 'country',
      type: 'string',
      required: true,
      description: '[ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2) 国家或地区代码。',
    },
    {
      path: `${prefix}_province`,
      name: 'province',
      type: 'string',
      description: '[ISO 3166-2](https://en.wikipedia.org/wiki/ISO_3166-2) 省/州代码。',
      condition: '当 `country` 为 `US` 或 `CA` 时必填。',
    },
  ]
}

export const doTransactionRequestFields: ValueBearingField[] = [
  // A. The common case: encoded object. In this API this shape is the norm,
  //    not the exception — nine request fields look exactly like this.
  {
    path: 'tx_billingInformation',
    name: 'billingInformation',
    type: 'string',
    format: 'json_string',
    description: '交易账单信息，包含客户账单地址和联系信息。',
    condition: '除订阅后续扣款 / 更新（`subscription.requestType=1` 或 `2`）外必填。',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      fields: contactFields('tx_billing'),
    },
  },

  // B. Encoded, but the document declares NO content schema. The format is a
  //    fact; there is nothing to expand. No empty disclosure may appear.
  {
    path: 'tx_metaData',
    name: 'metaData',
    type: 'string',
    format: 'json_string',
    description: '本次交易的商户自定义数据；交易查询和异步通知会原样返回。',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      notes: [{ label: '规则', text: '内容结构由商户自定，Onerway 不校验其中的字段。' }],
    },
  },

  // C. Encoded ARRAY — the decode boundary and the element boundary in one
  //    field. This is the fold the issue asks for by name.
  {
    path: 'tx_retailers',
    name: 'retailers',
    type: 'string',
    format: 'json_string',
    description: 'marketplace 交易的零售商信息；订单包含的每个零售商各传入一个对象。',
    lifecycle: { status: 'new', since: '2026-08-10', description: 'marketplace 零售商信息的新增字段。' },
    notes: [
      { label: '规则', text: '适用于 marketplace / 平台模式下商品由第三方零售商销售的场景；仅销售自有商品的商户无需传入。' },
      { label: '一致性', text: '传入该字段后，`txnOrderMsg.products` 中的每个商品都需要传入 `retailerId`，且取值需命中此处列出的某个零售商。' },
    ],
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object[]',
      value: {
        relation: 'item',
        type: 'object',
        fields: [
          {
            path: 'tx_retailers_retailerId',
            name: 'retailerId',
            type: 'string',
            required: true,
            description: '商户自行定义的零售商唯一标识；不是 `merchantNo` 中的 Onerway 子商户号。',
            notes: [{ label: '长度', text: '最多 64 字符。' }],
          },
          {
            path: 'tx_retailers_retailerName',
            name: 'retailerName',
            type: 'string',
            required: true,
            description: '零售商名称；建议传入其正式注册名称或对外经营名称。',
            notes: [{ label: '长度', text: '最多 128 字符。' }],
          },
          {
            path: 'tx_retailers_retailerCountry',
            name: 'retailerCountry',
            type: 'string',
            required: true,
            description: '零售商所在国家或地区，ISO 3166-1 alpha-2 代码。',
          },
        ],
      },
    },
  },

  // D. DOUBLE encoding — the trap. `txnOrderMsg` is a JSON string whose
  //    `products` property is ITSELF a JSON string carrying an array. The
  //    consumer's own example shows the escaped-inside-escaped result:
  //    "products":"[{\"name\":\"Demo product\",...}]"
  {
    path: 'tx_txnOrderMsg',
    name: 'txnOrderMsg',
    type: 'string',
    format: 'json_string',
    description: '交易业务信息，包含 `returnUrl`、`notifyUrl`、`appId`、商品信息以及商户采集的浏览器与设备信息。',
    condition: '除订阅后续扣款 / 更新（`subscription.requestType=1` 或 `2`）外必填。',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      fields: [
        {
          path: 'tx_txnOrderMsg_returnUrl',
          name: 'returnUrl',
          type: 'string',
          required: true,
          description: '同步回跳地址，主要用于 3DS challenge 等跳转场景。',
        },
        {
          path: 'tx_txnOrderMsg_products',
          name: 'products',
          type: 'string',
          format: 'json_string',
          required: true,
          description: '顾客购买的商品信息列表；商品金额、折扣和运费合计需要等于 `orderAmount`。',
          value: {
            relation: 'decoded',
            codec: 'json',
            type: 'object[]',
            value: {
              relation: 'item',
              type: 'object',
              fields: [
                { path: 'tx_products_name', name: 'name', type: 'string', required: true, description: '商品名称。' },
                { path: 'tx_products_price', name: 'price', type: 'string', required: true, description: '商品单价。' },
                { path: 'tx_products_num', name: 'num', type: 'string', required: true, description: '商品数量。' },
                {
                  path: 'tx_products_type',
                  name: 'type',
                  type: 'string',
                  description: '商品类别；默认不填即普通商品。`discount` 商品金额需要传负数。',
                  enumValues: [
                    { value: 'virtual', description: '虚拟商品。' },
                    { value: 'physical', description: '实物商品。' },
                    { value: 'shipping_fee', description: '运费商品项。' },
                    { value: 'discount', description: '折扣商品项，金额需要传负数。' },
                  ],
                },
                {
                  path: 'tx_products_retailerId',
                  name: 'retailerId',
                  type: 'string',
                  description: '销售该商品的零售商标识。',
                  condition: '传入 `retailers` 时必填。',
                  notes: [{ label: '一致性', text: '取值必须命中 `retailers` 中的某一个 `retailerId`。' }],
                  lifecycle: { status: 'new', since: '2026-08-10' },
                },
              ],
            },
          },
        },
        {
          path: 'tx_txnOrderMsg_transactionIp',
          name: 'transactionIp',
          type: 'string',
          required: true,
          description: '持卡人交易 IP，应为终端用户 IP，而不是商户服务器 IP。',
        },
      ],
    },
  },

  // E. Plain object nesting INSIDE an encoded payload — `card` / `share` are
  //    ordinary named children once you are past the decode boundary.
  {
    path: 'tx_paymentMethodOptions',
    name: 'paymentMethodOptions',
    type: 'string',
    format: 'json_string',
    description: '支付方式配置选项；直连交易支持 `card` 与 `share` 对象。',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      fields: [
        {
          path: 'tx_pmo_card',
          name: 'card',
          type: 'object',
          description: '卡支付配置项。',
          children: [
            {
              path: 'tx_pmo_card_avsEnabled',
              name: 'avsEnabled',
              type: 'boolean',
              description: '是否开启 AVS（地址验证服务）；使用前需提前联系 Onerway 开通。',
            },
          ],
        },
        {
          path: 'tx_pmo_share',
          name: 'share',
          type: 'object',
          description: '本次交易的分账配置。平台模式下，子商户收到的款项中会有一部分分给平台商户。',
          lifecycle: { status: 'new', since: '2026-08-10', description: '交易分账的新增对象。' },
          children: [
            {
              path: 'tx_pmo_share_profitShare',
              name: 'profitShare',
              type: 'boolean',
              description: '本次交易是否允许分账；启用后该笔交易才可参与后续分账。',
            },
            {
              path: 'tx_pmo_share_profitShareRate',
              name: 'profitShareRate',
              type: 'string',
              description: '自动分账比例，`1` 表示 1%，`100` 表示 100%。',
              notes: [
                { label: '范围', text: '1–100%。' },
                { label: '规则', text: '需传入整数形式的字符串；小数、`0`、负数或大于 100 的取值会被拒绝。' },
                { label: '一致性', text: '需与 `profitShare=true` 同时传入。' },
              ],
            },
          ],
        },
      ],
    },
  },
]

export const doTransactionResponseFields: ValueBearingField[] = [
  // F. Encoded object containing a PLAIN array — the decode boundary is
  //    crossed once, and `codeDetails` is an ordinary array field after it.
  {
    path: 'tx_codeForm',
    name: 'codeForm',
    type: 'string | null',
    format: 'json_string',
    description: '支付码信息对象，以 JSON 字符串承载。',
    condition: '需向用户展示支付码（二维码 / 条码）的支付方式才有值。',
    value: {
      relation: 'decoded',
      codec: 'json',
      type: 'object',
      fields: [
        {
          path: 'tx_codeForm_expireTime',
          name: 'expireTime',
          type: 'string | null',
          description: '支付码失效时间，ISO 8601 格式。',
        },
        {
          path: 'tx_codeForm_codeDetails',
          name: 'codeDetails',
          type: 'object[] | null',
          description: '支付码明细列表。',
          value: {
            relation: 'item',
            type: 'object',
            fields: [
              {
                path: 'tx_codeDetails_codeValueType',
                name: 'codeValueType',
                type: 'string | null',
                description: '码格式类型。',
                enumValues: [
                  { value: 'BARCODE', description: '条形码格式。' },
                  { value: 'QRCODE', description: '二维码格式。' },
                ],
              },
              {
                path: 'tx_codeDetails_codeValue',
                name: 'codeValue',
                type: 'string | null',
                description: '码内容值，供用户展示或终端扫描的实际编码数据。',
              },
              {
                path: 'tx_codeDetails_displayType',
                name: 'displayType',
                type: 'string | null',
                description: '展示方式，决定码在 UI 中如何渲染。',
                enumValues: [
                  { value: 'TEXT', description: '以文本或可复制标签展示。' },
                  { value: 'IMAGE', description: '以适合扫描的图片展示。' },
                ],
              },
            ],
          },
        },
      ],
    },
  },
]
