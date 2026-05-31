import type {
  ClaimDto,
  CoverImageDto,
  DiscussionMetricsDto,
  EventDetailDto,
  EventListItemDto,
  PlatformLinkDto,
  RevisionDto,
  SourceDto,
  TimelineEntryDto
} from "@memory-archive/shared";

export interface CandidateDto {
  id: string;
  title: string;
  community: string;
  status: string;
  stage: string;
  focus: string;
  coverImage?: CoverImageDto;
  discussionMetrics: DiscussionMetricsDto;
}

export const mockCandidates: CandidateDto[] = [
  {
    id: "cand_1",
    title: "扬州 TCW 漫展男 Coser 被清退争议",
    community: "乙游 / 漫展",
    status: "待建档",
    stage: "主办方回应后",
    focus: "角色扮演边界、线下秩序、圈层规则",
    discussionMetrics: {
      sourceCount: 3,
      platformCount: 3,
      timelineCount: 0,
      latestUpdateAt: "2026-05-05T10:00:00.000Z",
      discussionStage: "主办方回应后"
    }
  },
  {
    id: "cand_2",
    title: "《洛克王国：世界》S2 更新“暗改”与官方致歉争议",
    community: "游戏 / 二游",
    status: "待建档",
    stage: "官方说明后",
    focus: "版本透明度、玩家信任、社区沟通",
    discussionMetrics: {
      sourceCount: 3,
      platformCount: 3,
      timelineCount: 0,
      latestUpdateAt: "2026-05-22T10:00:00.000Z",
      discussionStage: "官方说明后"
    }
  },
  {
    id: "cand_3",
    title: "《洛克王国：世界》PV 疑似借鉴争议",
    community: "游戏宣发",
    status: "待建档",
    stage: "材料收集中",
    focus: "宣发素材相似性、下架/修改回应",
    discussionMetrics: {
      sourceCount: 1,
      platformCount: 1,
      timelineCount: 0,
      latestUpdateAt: "2026-05-16T10:00:00.000Z",
      discussionStage: "材料收集中"
    }
  },
  {
    id: "cand_4",
    title: "广州漫展女 Coser 被围拍/骚扰争议",
    community: "漫展 / 线下秩序",
    status: "待建档",
    stage: "当事人回应后",
    focus: "隐私保护、线下边界、活动秩序",
    discussionMetrics: {
      sourceCount: 0,
      platformCount: 0,
      timelineCount: 0,
      latestUpdateAt: "2026-05-20T10:00:00.000Z",
      discussionStage: "隐私与线下秩序候选"
    }
  }
];

export const mockEvents: EventListItemDto[] = [
  {
    id: "evt_relationship",
    slug: "platform-relationship-dispute-archive",
    title: "某平台婚恋纠纷引发网络争议",
    neutralTitle: "某平台婚恋纠纷引发网络争议",
    summary:
      "一次婚恋纠纷在社交平台扩散后，多方先后发布文字、视频和媒体回应。档案仅记录公开资料中的时间线、主张差异、平台介入和后续修订。",
    editorialStatus: "PUBLISHED",
    eventProcessStatus: "PLATFORM_INTERVENED",
    updatedAt: "2026-05-18T08:00:00.000Z",
    topic: { slug: "relationship-public-disputes", name: "婚恋与公共争议" },
    tags: [
      { id: "tag_gender", slug: "gender-discourse", label: "性别议题" },
      { id: "tag_reversal", slug: "public-opinion-reversal", label: "舆论反转" },
      { id: "tag_platform", slug: "platform-response", label: "平台介入" }
    ],
    sourceCount: 4,
    timelineCount: 4,
    platformLinkCount: 3,
    discussionMetrics: {
      sourceCount: 4,
      platformCount: 3,
      timelineCount: 4,
      latestUpdateAt: "2026-05-18T08:00:00.000Z",
      discussionStage: "平台介入后"
    }
  },
  {
    id: "evt_campus",
    slug: "campus-reporting-dispute-archive",
    title: "某高校校园举报事件",
    neutralTitle: "某高校校园举报事件",
    summary:
      "一则校园举报帖引发跨平台讨论，学校、涉事方和媒体先后回应。档案按公开材料记录调查进度、争议点和证据等级。",
    editorialStatus: "PUBLISHED",
    eventProcessStatus: "OFFICIAL_INVESTIGATION",
    updatedAt: "2026-05-18T09:00:00.000Z",
    topic: { slug: "campus-public-disputes", name: "校园公共争议" },
    tags: [
      { id: "tag_campus", slug: "campus", label: "校园争议" },
      { id: "tag_privacy", slug: "privacy-protection", label: "隐私保护" },
      { id: "tag_media", slug: "media-follow-up", label: "媒体跟进" }
    ],
    sourceCount: 4,
    timelineCount: 4,
    platformLinkCount: 3,
    discussionMetrics: {
      sourceCount: 4,
      platformCount: 2,
      timelineCount: 4,
      latestUpdateAt: "2026-05-18T09:00:00.000Z",
      discussionStage: "官方调查中"
    }
  }
];

export const mockDetails: Record<string, EventDetailDto> = {
  "platform-relationship-dispute-archive": {
    ...mockEvents[0],
    whatWeKnow: [
      "最早传播材料来自当事人 A 的社交平台发帖。",
      "当事人 B 随后发布回应，否认部分叙述并补充聊天记录截图。",
      "平台客服页面显示争议内容曾进入投诉处理流程。"
    ],
    whatIsDisputed: [
      "双方对共同支出性质、分手原因和沟通过程存在差异。",
      "部分截图是否完整、是否存在上下文缺失仍无法独立核验。"
    ],
    whatNotToInfer: [
      "不得把个案上升为任何性别群体的道德判断。",
      "未被核验的截图只能作为线索，不能单独支撑结论。"
    ],
    latestUpdates: ["平台回应称已限制部分传播过度的二次剪辑。"],
    correctionEnabled: true,
    reportEnabled: true
  },
  "campus-reporting-dispute-archive": {
    ...mockEvents[1],
    whatWeKnow: [
      "举报帖在多个平台被转发后，学校发布情况说明。",
      "涉事方账号发布回应，否认部分描述并称已配合调查。",
      "截至档案当前版本，官方调查仍在进行。"
    ],
    whatIsDisputed: [
      "举报材料中若干时间点与涉事方回应存在差异。",
      "部分二次传播图片缺少来源页面和发布时间。"
    ],
    whatNotToInfer: [
      "调查未完成前，不应对任何个人作定罪式判断。",
      "不得扩散学生姓名、宿舍、班级等可识别信息。"
    ],
    latestUpdates: ["学校称工作组仍在核验材料。"],
    correctionEnabled: true,
    reportEnabled: true
  }
};

export const mockPlatformLinks: Record<string, PlatformLinkDto[]> = {
  "platform-relationship-dispute-archive": [
    {
      id: "pl_xhs",
      sourceId: "src_a",
      platform: "XIAOHONGSHU",
      contentKind: "NOTE",
      originalUrl: "https://example.com/xhs/relationship-note-a",
      canonicalUrl: "https://example.com/xhs/relationship-note-a",
      title: "当事人 A 关于婚恋纠纷的初始笔记",
      description:
        "笔记以个人叙述形式说明相识、交往和分手后的争议经过，并附带若干聊天截图。档案仅记录其存在和主要说法，不全文搬运原帖内容。",
      authorDisplay: "当事人 A",
      publishedAt: "2026-03-12T08:00:00.000Z",
      capturedAt: "2026-05-20T10:00:00.000Z",
      availabilityStatus: "AVAILABLE",
      displayOrder: 1,
      archiveUrl: "https://webcache.example/archive/xhs"
    },
    {
      id: "pl_bili",
      sourceId: "src_b",
      platform: "BILIBILI",
      contentKind: "VIDEO",
      originalUrl: "https://example.com/bilibili/relationship-response-b",
      canonicalUrl: "https://example.com/bilibili/relationship-response-b",
      title: "当事人 B 对争议经过的公开视频回应",
      description:
        "视频回应聚焦费用性质、聊天上下文和平台投诉进展，包含部分屏幕录制片段。档案只提供跳转和存档状态，避免替代原平台阅读。",
      authorDisplay: "当事人 B",
      publishedAt: "2026-03-15T11:00:00.000Z",
      capturedAt: "2026-05-20T10:00:00.000Z",
      availabilityStatus: "AVAILABLE",
      displayOrder: 2,
      archiveUrl: "https://webcache.example/archive/bili"
    },
    {
      id: "pl_weibo",
      sourceId: "src_media",
      platform: "WEIBO",
      contentKind: "POST",
      originalUrl: "https://example.com/weibo/media-thread-relationship",
      canonicalUrl: "https://example.com/weibo/media-thread-relationship",
      title: "媒体发布采访摘要及平台回应摘录",
      description:
        "微博帖整合采访摘要、平台回应要点和后续链接。该材料属于媒体转述，不等同于司法或行政结论，需要与原始陈述分开阅读。",
      authorDisplay: "城市观察",
      publishedAt: "2026-03-20T14:00:00.000Z",
      capturedAt: "2026-05-20T10:00:00.000Z",
      availabilityStatus: "AVAILABLE",
      displayOrder: 3,
      archiveUrl: "https://webcache.example/archive/weibo"
    }
  ],
  "campus-reporting-dispute-archive": [
    {
      id: "pl_campus_weibo",
      sourceId: "src_report",
      platform: "WEIBO",
      contentKind: "POST",
      originalUrl: "https://example.com/weibo/campus-report-thread",
      canonicalUrl: "https://example.com/weibo/campus-report-thread",
      title: "举报人 C 发布校园事件公开长文",
      description:
        "长文叙述校内沟通与举报诉求，包含若干截图和时间点说明。档案仅索引原帖入口，并隐藏可能识别个人身份的细节。",
      authorDisplay: "举报人 C",
      publishedAt: "2026-04-08T07:30:00.000Z",
      capturedAt: "2026-05-20T10:00:00.000Z",
      availabilityStatus: "AVAILABLE",
      displayOrder: 1,
      archiveUrl: "https://webcache.example/archive/campus-weibo"
    },
    {
      id: "pl_campus_bili",
      sourceId: "src_bili",
      platform: "BILIBILI",
      contentKind: "VIDEO",
      originalUrl: "https://example.com/bilibili/campus-analysis",
      title: "校园举报事件公开资料时间线梳理",
      description:
        "视频以公开材料为线索梳理发帖、学校说明和媒体跟进顺序，结尾提示调查未完成前不应传播学生身份信息。",
      authorDisplay: "公共议题观察账号",
      publishedAt: "2026-04-12T15:30:00.000Z",
      capturedAt: "2026-05-20T10:00:00.000Z",
      availabilityStatus: "AVAILABLE",
      displayOrder: 2,
      archiveUrl: "https://webcache.example/archive/campus-bili"
    }
  ]
};

export const mockTimeline: Record<string, TimelineEntryDto[]> = {
  "platform-relationship-dispute-archive": [
    {
      id: "tl1",
      title: "初始发帖出现",
      body: "当事人 A 在社交平台发布个人陈述，事件开始进入公共讨论空间。",
      happenedAt: "2026-03-12T08:00:00.000Z",
      sourceId: "src_a",
      sourceTitle: "当事人 A 初始发帖说明",
      reliabilityLevel: "B_DIRECT",
      sortOrder: 1
    },
    {
      id: "tl2",
      title: "另一方发布视频回应",
      body: "当事人 B 对部分陈述提出异议，并补充若干材料说明。",
      happenedAt: "2026-03-15T11:00:00.000Z",
      sourceId: "src_b",
      sourceTitle: "当事人 B 视频回应",
      reliabilityLevel: "B_DIRECT",
      sortOrder: 2
    },
    {
      id: "tl3",
      title: "平台介入处理",
      body: "平台公开页面显示投诉流程启动，要求相关账号补充证明材料。",
      happenedAt: "2026-03-17T09:00:00.000Z",
      sourceId: "src_platform",
      sourceTitle: "平台投诉处理页面说明",
      reliabilityLevel: "A_STRONG",
      sortOrder: 3
    }
  ],
  "campus-reporting-dispute-archive": [
    {
      id: "ctl1",
      title: "举报帖发布",
      body: "举报人 C 发布长文，事件开始在多个平台传播。",
      happenedAt: "2026-04-08T07:30:00.000Z",
      sourceId: "src_report",
      sourceTitle: "举报帖公开摘要",
      reliabilityLevel: "B_DIRECT",
      sortOrder: 1
    },
    {
      id: "ctl2",
      title: "学校发布情况说明",
      body: "学校称成立工作组并启动材料核验。",
      happenedAt: "2026-04-10T12:00:00.000Z",
      sourceId: "src_school",
      sourceTitle: "学校情况说明",
      reliabilityLevel: "A_STRONG",
      sortOrder: 2
    }
  ]
};

export const mockClaims: Record<string, ClaimDto[]> = {
  "platform-relationship-dispute-archive": [
    {
      id: "claim1",
      title: "关于共同支出性质的说法",
      statement: "当事人 A 称部分支出属于恋爱期间共同规划下的费用。",
      status: "DISPUTED",
      importance: "KEY",
      claimantActorDisplay: "当事人 A",
      evidenceLinks: [
        {
          id: "cel1",
          relationType: "SUPPORTS",
          notes: "支持当事人 A 曾作出该说法，不证明说法本身全部成立。",
          evidence: {
            id: "ev1",
            title: "初始发帖截图组",
            description: "由当事人 A 发布的原始帖子及截图组。",
            evidenceKind: "POST",
            reliabilityLevel: "B_DIRECT",
            sourceId: "src_a",
            sourceTitle: "当事人 A 初始发帖说明"
          }
        },
        {
          id: "cel2",
          relationType: "OPPOSES",
          notes: "回应视频对费用性质提出不同解释。",
          evidence: {
            id: "ev2",
            title: "回应视频及屏幕录制片段",
            description: "当事人 B 公开发布的视频回应。",
            evidenceKind: "VIDEO",
            reliabilityLevel: "B_DIRECT",
            sourceId: "src_b",
            sourceTitle: "当事人 B 视频回应"
          }
        }
      ]
    }
  ],
  "campus-reporting-dispute-archive": [
    {
      id: "claim_c1",
      title: "学校已启动工作组",
      statement: "学校说明称已成立工作组核验材料。",
      status: "SUPPORTED",
      importance: "KEY",
      claimantActorDisplay: "某高校",
      evidenceLinks: [
        {
          id: "cel_c1",
          relationType: "SUPPORTS",
          notes: "学校情况说明直接支持该流程事实。",
          evidence: {
            id: "ev_c1",
            title: "学校情况说明网页",
            description: "学校发布的情况说明，证明校方已启动调查流程。",
            evidenceKind: "DOCUMENT",
            reliabilityLevel: "A_STRONG",
            sourceId: "src_school",
            sourceTitle: "学校情况说明"
          }
        }
      ]
    }
  ]
};

export const mockSources: Record<string, SourceDto[]> = {
  "platform-relationship-dispute-archive": [
    {
      id: "src_a",
      title: "当事人 A 初始发帖说明",
      url: "https://example.com/xhs/relationship-note-a",
      sourceType: "ORIGINAL_POST",
      reliabilityLevel: "B_DIRECT",
      publisher: "小红书",
      authorDisplay: "当事人 A",
      publishedAt: "2026-03-12T08:00:00.000Z",
      summary: "当事人 A 对恋爱期间沟通、支出和分手经过作出个人陈述。"
    },
    {
      id: "src_platform",
      title: "平台投诉处理页面说明",
      url: "https://example.com/platform/case-status",
      sourceType: "OFFICIAL_NOTICE",
      reliabilityLevel: "A_STRONG",
      publisher: "涉事平台",
      authorDisplay: "平台安全中心",
      publishedAt: "2026-03-17T09:00:00.000Z",
      summary: "平台页面显示争议内容进入投诉处理流程。"
    }
  ],
  "campus-reporting-dispute-archive": [
    {
      id: "src_school",
      title: "学校情况说明",
      url: "https://example.com/university/campus-statement",
      sourceType: "OFFICIAL_NOTICE",
      reliabilityLevel: "A_STRONG",
      publisher: "某高校",
      authorDisplay: "学校办公室",
      publishedAt: "2026-04-10T12:00:00.000Z",
      summary: "学校称已成立工作组，将依法依规核验相关材料。"
    }
  ]
};

export const mockVersions: Record<string, RevisionDto[]> = {
  "platform-relationship-dispute-archive": [
    {
      id: "ver1",
      versionNumber: 1,
      changeSummary: "创建首版公开档案，写入来源、时间线、主张与证据矩阵。",
      createdAt: "2026-05-18T08:00:00.000Z"
    }
  ],
  "campus-reporting-dispute-archive": [
    {
      id: "ver_c1",
      versionNumber: 1,
      changeSummary: "创建首版校园举报事件档案，纳入官方说明、当事人陈述与媒体跟进。",
      createdAt: "2026-05-18T09:00:00.000Z"
    }
  ]
};
