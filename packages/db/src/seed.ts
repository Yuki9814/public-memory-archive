import { prisma } from "./client.js";

type SeedPlatformLink = {
  platform: "BILIBILI" | "XIAOHONGSHU" | "WEIBO";
  contentKind: "VIDEO" | "NOTE" | "POST";
  originalUrl: string;
  title: string;
  description: string;
  authorDisplay: string;
  thumbnailUrl?: string;
  publishedAt: Date;
  availabilityStatus: "AVAILABLE" | "ARCHIVED_ONLY";
  engagementSnapshot: Record<string, string | number | boolean | null>;
};

async function clearData() {
  await prisma.auditLog.deleteMany();
  await prisma.editorNote.deleteMany();
  await prisma.reviewTask.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.eventTag.deleteMany();
  await prisma.report.deleteMany();
  await prisma.correction.deleteMany();
  await prisma.eventVersion.deleteMany();
  await prisma.claimEvidenceLink.deleteMany();
  await prisma.evidenceItem.deleteMany();
  await prisma.claim.deleteMany();
  await prisma.timelineEntry.deleteMany();
  await prisma.archiveCapture.deleteMany();
  await prisma.sourcePlatformLink.deleteMany();
  await prisma.source.deleteMany();
  await prisma.eventActor.deleteMany();
  await prisma.event.deleteMany();
  await prisma.actor.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.topic.deleteMany();
  await prisma.user.deleteMany();
}

function publicSnapshot(event: {
  id: string;
  slug: string;
  title: string;
  neutralTitle: string;
  summary: string;
}) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    neutralTitle: event.neutralTitle,
    summary: event.summary
  };
}

async function createPlatformLink(sourceId: string, link: SeedPlatformLink, displayOrder: number) {
  return prisma.sourcePlatformLink.create({
    data: {
      sourceId,
      platform: link.platform,
      contentKind: link.contentKind,
      originalUrl: link.originalUrl,
      canonicalUrl: link.originalUrl,
      title: link.title,
      description: link.description,
      authorDisplay: link.authorDisplay,
      thumbnailUrl: link.thumbnailUrl,
      publishedAt: link.publishedAt,
      capturedAt: new Date("2026-05-20T10:00:00Z"),
      availabilityStatus: link.availabilityStatus,
      engagementSnapshot: link.engagementSnapshot,
      archiveUrl: `https://webcache.example/archive/${encodeURIComponent(link.originalUrl)}`,
      displayOrder
    }
  });
}

async function seedMarriageDispute(adminId: string, topicId: string, tagIds: string[]) {
  const event = await prisma.event.create({
    data: {
      slug: "platform-relationship-dispute-archive",
      title: "某平台婚恋纠纷引发网络争议",
      neutralTitle: "某平台婚恋纠纷引发网络争议",
      summary:
        "一次婚恋纠纷在社交平台扩散后，多方先后发布文字、视频和媒体回应。档案仅记录公开资料中的时间线、主张差异、平台介入和后续修订，不推断群体责任。",
      editorialStatus: "PUBLISHED",
      eventProcessStatus: "PLATFORM_INTERVENED",
      occurredAt: new Date("2026-03-12T08:00:00Z"),
      firstPublishedAt: new Date("2026-05-18T08:00:00Z"),
      topicId,
      whatWeKnow: [
        "最早传播材料来自当事人 A 的社交平台发帖。",
        "当事人 B 随后发布回应，否认部分叙述并补充聊天记录截图。",
        "平台客服页面显示争议内容曾进入投诉处理流程。",
        "媒体报道未给出司法结论，仅确认平台已接收双方材料。"
      ],
      whatIsDisputed: [
        "双方对共同支出性质、分手原因和沟通过程存在差异。",
        "部分截图是否完整、是否存在上下文缺失仍无法独立核验。",
        "网友转述中的金额和时间点存在多个版本。"
      ],
      whatNotToInfer: [
        "不得把个案上升为任何性别群体的道德判断。",
        "不得使用档案内容定位、骚扰或识别当事人。",
        "未被核验的截图只能作为线索，不能单独支撑结论。"
      ],
      latestUpdates: [
        "平台回应称已限制部分传播过度的二次剪辑。",
        "媒体后续报道确认双方仍在提交补充材料。"
      ]
    }
  });

  for (const tagId of tagIds) {
    await prisma.eventTag.create({ data: { eventId: event.id, tagId } });
  }

  const actorA = await prisma.actor.create({
    data: {
      displayName: "当事人 A",
      privacyLevel: "HIGH",
      privacyNote: "普通个人，公开页仅使用代称，不展示可识别身份信息。"
    }
  });
  const actorB = await prisma.actor.create({
    data: {
      displayName: "当事人 B",
      privacyLevel: "HIGH",
      privacyNote: "普通个人，公开页仅使用代称，不展示可识别身份信息。"
    }
  });
  const platformActor = await prisma.actor.create({
    data: {
      displayName: "涉事平台",
      actorType: "PLATFORM",
      privacyLevel: "PUBLIC"
    }
  });

  await prisma.eventActor.createMany({
    data: [
      {
        eventId: event.id,
        actorId: actorA.id,
        role: "COMPLAINANT",
        involvementSummary: "发布初始陈述与若干截图材料。",
        sortOrder: 1
      },
      {
        eventId: event.id,
        actorId: actorB.id,
        role: "RESPONDENT",
        involvementSummary: "发布回应并对部分说法提出异议。",
        sortOrder: 2
      },
      {
        eventId: event.id,
        actorId: platformActor.id,
        role: "PLATFORM",
        involvementSummary: "接收投诉并调整部分内容可见性。",
        sortOrder: 3
      }
    ]
  });

  const sourceA = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "当事人 A 初始发帖说明",
      url: "https://example.com/xhs/relationship-note-a",
      sourceType: "ORIGINAL_POST",
      reliabilityLevel: "B_DIRECT",
      publisher: "小红书",
      authorDisplay: "当事人 A",
      publishedAt: new Date("2026-03-12T08:00:00Z"),
      summary: "当事人 A 对恋爱期间沟通、支出和分手经过作出个人陈述，并附带部分截图。"
    }
  });
  const sourceB = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "当事人 B 视频回应",
      url: "https://example.com/bilibili/relationship-response-b",
      sourceType: "VIDEO",
      reliabilityLevel: "B_DIRECT",
      publisher: "B站",
      authorDisplay: "当事人 B",
      publishedAt: new Date("2026-03-15T11:00:00Z"),
      summary: "当事人 B 发布视频说明，对关键时间点和支出性质提出不同叙述。"
    }
  });
  const sourcePlatform = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "平台投诉处理页面说明",
      url: "https://example.com/platform/case-status",
      sourceType: "OFFICIAL_NOTICE",
      reliabilityLevel: "A_STRONG",
      publisher: "涉事平台",
      authorDisplay: "平台安全中心",
      publishedAt: new Date("2026-03-17T09:00:00Z"),
      summary: "平台页面显示争议内容进入投诉处理流程，并提示双方补充证明材料。"
    }
  });
  const sourceMedia = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "地方媒体采访摘要",
      url: "https://example.com/news/relationship-dispute-summary",
      sourceType: "MEDIA_REPORT",
      reliabilityLevel: "C_INDIRECT",
      publisher: "城市观察",
      authorDisplay: "记者编辑部",
      publishedAt: new Date("2026-03-20T14:00:00Z"),
      summary: "报道采访双方相关人员并引用平台回应，未对事实争点作结论性判断。"
    }
  });

  await createPlatformLink(
    sourceA.id,
    {
      platform: "XIAOHONGSHU",
      contentKind: "NOTE",
      originalUrl: "https://example.com/xhs/relationship-note-a",
      title: "当事人 A 关于婚恋纠纷的初始笔记",
      description:
        "笔记以个人叙述形式说明相识、交往和分手后的争议经过，并附带若干聊天截图。档案仅记录其存在和主要说法，不全文搬运原帖内容。",
      authorDisplay: "当事人 A",
      publishedAt: new Date("2026-03-12T08:00:00Z"),
      availabilityStatus: "AVAILABLE",
      engagementSnapshot: { likes: 18200, comments: 3400 }
    },
    1
  );
  await createPlatformLink(
    sourceB.id,
    {
      platform: "BILIBILI",
      contentKind: "VIDEO",
      originalUrl: "https://example.com/bilibili/relationship-response-b",
      title: "当事人 B 对争议经过的公开视频回应",
      description:
        "视频回应聚焦费用性质、聊天上下文和平台投诉进展，包含部分屏幕录制片段。档案只提供跳转和存档状态，避免替代原平台阅读。",
      authorDisplay: "当事人 B",
      publishedAt: new Date("2026-03-15T11:00:00Z"),
      availabilityStatus: "AVAILABLE",
      engagementSnapshot: { views: 931000, danmaku: 5200 }
    },
    2
  );
  await createPlatformLink(
    sourceMedia.id,
    {
      platform: "WEIBO",
      contentKind: "POST",
      originalUrl: "https://example.com/weibo/media-thread-relationship",
      title: "媒体发布采访摘要及平台回应摘录",
      description:
        "微博帖整合采访摘要、平台回应要点和后续链接。该材料属于媒体转述，不等同于司法或行政结论，需要与原始陈述分开阅读。",
      authorDisplay: "城市观察",
      publishedAt: new Date("2026-03-20T14:00:00Z"),
      availabilityStatus: "AVAILABLE",
      engagementSnapshot: { reposts: 6100, comments: 8800 }
    },
    3
  );

  await prisma.timelineEntry.createMany({
    data: [
      {
        eventId: event.id,
        sourceId: sourceA.id,
        title: "初始发帖出现",
        body: "当事人 A 在社交平台发布个人陈述，事件开始进入公共讨论空间。",
        happenedAt: new Date("2026-03-12T08:00:00Z"),
        sortOrder: 1
      },
      {
        eventId: event.id,
        sourceId: sourceB.id,
        title: "另一方发布视频回应",
        body: "当事人 B 对部分陈述提出异议，并补充若干材料说明。",
        happenedAt: new Date("2026-03-15T11:00:00Z"),
        sortOrder: 2
      },
      {
        eventId: event.id,
        sourceId: sourcePlatform.id,
        title: "平台介入处理",
        body: "平台公开页面显示投诉流程启动，要求相关账号补充证明材料。",
        happenedAt: new Date("2026-03-17T09:00:00Z"),
        sortOrder: 3
      },
      {
        eventId: event.id,
        sourceId: sourceMedia.id,
        title: "媒体发布采访摘要",
        body: "地方媒体整理双方说法和平台回应，提示读者区分当事人陈述与外部核验。",
        happenedAt: new Date("2026-03-20T14:00:00Z"),
        sortOrder: 4
      }
    ]
  });

  const evidenceA = await prisma.evidenceItem.create({
    data: {
      eventId: event.id,
      sourceId: sourceA.id,
      title: "初始发帖截图组",
      description: "由当事人 A 发布的原始帖子及截图组，作为其个人陈述的直接材料。",
      evidenceKind: "POST",
      reliabilityLevel: "B_DIRECT",
      externalUrl: sourceA.url
    }
  });
  const evidenceB = await prisma.evidenceItem.create({
    data: {
      eventId: event.id,
      sourceId: sourceB.id,
      title: "回应视频及屏幕录制片段",
      description: "由当事人 B 公开发布的视频回应，涉及对支出性质和沟通过程的不同说明。",
      evidenceKind: "VIDEO",
      reliabilityLevel: "B_DIRECT",
      externalUrl: sourceB.url
    }
  });
  const evidencePlatform = await prisma.evidenceItem.create({
    data: {
      eventId: event.id,
      sourceId: sourcePlatform.id,
      title: "平台投诉处理状态页面",
      description: "平台安全中心展示的处理状态，能证明存在平台介入流程。",
      evidenceKind: "DOCUMENT",
      reliabilityLevel: "A_STRONG",
      externalUrl: sourcePlatform.url
    }
  });

  const claim1 = await prisma.claim.create({
    data: {
      eventId: event.id,
      claimantActorId: actorA.id,
      sourceId: sourceA.id,
      title: "关于共同支出性质的说法",
      statement: "当事人 A 称部分支出属于恋爱期间共同规划下的费用。",
      status: "DISPUTED",
      importance: "KEY"
    }
  });
  const claim2 = await prisma.claim.create({
    data: {
      eventId: event.id,
      claimantActorId: platformActor.id,
      sourceId: sourcePlatform.id,
      title: "平台已介入处理",
      statement: "平台页面显示投诉处理流程已经启动。",
      status: "SUPPORTED",
      importance: "KEY"
    }
  });

  await prisma.claimEvidenceLink.createMany({
    data: [
      {
        claimId: claim1.id,
        evidenceId: evidenceA.id,
        relationType: "SUPPORTS",
        notes: "支持当事人 A 曾作出该说法，不证明说法本身全部成立。"
      },
      {
        claimId: claim1.id,
        evidenceId: evidenceB.id,
        relationType: "OPPOSES",
        notes: "回应视频对费用性质提出不同解释。"
      },
      {
        claimId: claim2.id,
        evidenceId: evidencePlatform.id,
        relationType: "SUPPORTS",
        notes: "平台页面与媒体报道均显示存在处理流程。"
      }
    ]
  });

  await prisma.eventVersion.create({
    data: {
      eventId: event.id,
      versionNumber: 1,
      snapshotBefore: {},
      snapshotAfter: publicSnapshot(event),
      changeSummary: "创建首版公开档案，写入来源、时间线、主张与证据矩阵。",
      createdByUserId: adminId
    }
  });

  return event;
}

async function seedCampusCase(adminId: string, topicId: string, tagIds: string[]) {
  const event = await prisma.event.create({
    data: {
      slug: "campus-reporting-dispute-archive",
      title: "某高校校园举报事件",
      neutralTitle: "某高校校园举报事件",
      summary:
        "一则校园举报帖引发跨平台讨论，学校、涉事方和媒体先后回应。档案按公开材料记录调查进度、争议点和证据等级，避免对未完成调查作结论。",
      editorialStatus: "PUBLISHED",
      eventProcessStatus: "OFFICIAL_INVESTIGATION",
      occurredAt: new Date("2026-04-08T07:30:00Z"),
      firstPublishedAt: new Date("2026-05-18T09:00:00Z"),
      topicId,
      whatWeKnow: [
        "举报帖在多个平台被转发后，学校发布情况说明。",
        "涉事方账号发布回应，否认部分描述并称已配合调查。",
        "媒体跟进报道确认学校成立工作组。",
        "截至档案当前版本，官方调查仍在进行。"
      ],
      whatIsDisputed: [
        "举报材料中若干时间点与涉事方回应存在差异。",
        "部分二次传播图片缺少来源页面和发布时间。",
        "校内处理流程是否及时充分仍需更多公开材料支持。"
      ],
      whatNotToInfer: [
        "调查未完成前，不应对任何个人作定罪式判断。",
        "不得扩散学生姓名、宿舍、班级等可识别信息。",
        "不得将校园个案概括为对某一性别群体的归因。"
      ],
      latestUpdates: [
        "学校称工作组仍在核验材料。",
        "媒体补充报道删除了早期无法核验的截图来源。"
      ]
    }
  });

  for (const tagId of tagIds) {
    await prisma.eventTag.create({ data: { eventId: event.id, tagId } });
  }

  const reporter = await prisma.actor.create({
    data: {
      displayName: "举报人 C",
      privacyLevel: "HIGH",
      privacyNote: "普通学生身份，公开页仅使用代称，不展示学院、班级等信息。"
    }
  });
  const respondent = await prisma.actor.create({
    data: {
      displayName: "涉事方 D",
      privacyLevel: "HIGH",
      privacyNote: "普通学生身份，公开页仅使用代称，不展示可识别身份信息。"
    }
  });
  const university = await prisma.actor.create({
    data: {
      displayName: "某高校",
      actorType: "ORGANIZATION",
      privacyLevel: "PUBLIC"
    }
  });

  await prisma.eventActor.createMany({
    data: [
      {
        eventId: event.id,
        actorId: reporter.id,
        role: "COMPLAINANT",
        involvementSummary: "发布举报材料并提交校内处理申请。",
        sortOrder: 1
      },
      {
        eventId: event.id,
        actorId: respondent.id,
        role: "RESPONDENT",
        involvementSummary: "发布回应并称愿意配合学校调查。",
        sortOrder: 2
      },
      {
        eventId: event.id,
        actorId: university.id,
        role: "OFFICIAL",
        involvementSummary: "发布情况说明并成立工作组。",
        sortOrder: 3
      }
    ]
  });

  const sourceReport = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "举报帖公开摘要",
      url: "https://example.com/weibo/campus-report-thread",
      sourceType: "ORIGINAL_POST",
      reliabilityLevel: "B_DIRECT",
      publisher: "微博",
      authorDisplay: "举报人 C",
      publishedAt: new Date("2026-04-08T07:30:00Z"),
      summary: "举报人 C 发布长文，叙述校内处理经历和相关诉求。"
    }
  });
  const sourceSchool = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "学校情况说明",
      url: "https://example.com/university/campus-statement",
      sourceType: "OFFICIAL_NOTICE",
      reliabilityLevel: "A_STRONG",
      publisher: "某高校",
      authorDisplay: "学校办公室",
      publishedAt: new Date("2026-04-10T12:00:00Z"),
      summary: "学校称已成立工作组，将依法依规核验相关材料。"
    }
  });
  const sourceBili = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "B站解读视频",
      url: "https://example.com/bilibili/campus-analysis",
      sourceType: "VIDEO",
      reliabilityLevel: "C_INDIRECT",
      publisher: "B站",
      authorDisplay: "公共议题观察账号",
      publishedAt: new Date("2026-04-12T15:30:00Z"),
      summary: "视频梳理公开时间线并提醒不要传播可识别学生信息。"
    }
  });
  const sourceMedia = await prisma.source.create({
    data: {
      eventId: event.id,
      title: "媒体跟进报道",
      url: "https://example.com/news/campus-follow-up",
      sourceType: "MEDIA_REPORT",
      reliabilityLevel: "C_INDIRECT",
      publisher: "公共新闻周刊",
      authorDisplay: "教育线记者",
      publishedAt: new Date("2026-04-14T10:00:00Z"),
      summary: "媒体报道确认学校工作组信息，并引用双方部分公开回应。"
    }
  });

  await createPlatformLink(
    sourceReport.id,
    {
      platform: "WEIBO",
      contentKind: "POST",
      originalUrl: "https://example.com/weibo/campus-report-thread",
      title: "举报人 C 发布校园事件公开长文",
      description:
        "长文叙述校内沟通与举报诉求，包含若干截图和时间点说明。档案仅索引原帖入口，并隐藏可能识别个人身份的细节。",
      authorDisplay: "举报人 C",
      publishedAt: new Date("2026-04-08T07:30:00Z"),
      availabilityStatus: "AVAILABLE",
      engagementSnapshot: { reposts: 22100, comments: 11800 }
    },
    1
  );
  await createPlatformLink(
    sourceBili.id,
    {
      platform: "BILIBILI",
      contentKind: "VIDEO",
      originalUrl: "https://example.com/bilibili/campus-analysis",
      title: "校园举报事件公开资料时间线梳理",
      description:
        "视频以公开材料为线索梳理发帖、学校说明和媒体跟进顺序，结尾提示调查未完成前不应传播学生身份信息。",
      authorDisplay: "公共议题观察账号",
      publishedAt: new Date("2026-04-12T15:30:00Z"),
      availabilityStatus: "AVAILABLE",
      engagementSnapshot: { views: 483000, favorites: 17600 }
    },
    2
  );
  await createPlatformLink(
    sourceMedia.id,
    {
      platform: "XIAOHONGSHU",
      contentKind: "NOTE",
      originalUrl: "https://example.com/xhs/campus-note-summary",
      title: "媒体账号发布校园事件后续摘要",
      description:
        "笔记引用媒体跟进报道和学校说明，列出仍待核验的争议点。该材料为二次整理，档案标记为间接来源。",
      authorDisplay: "公共新闻周刊",
      publishedAt: new Date("2026-04-14T10:00:00Z"),
      availabilityStatus: "ARCHIVED_ONLY",
      engagementSnapshot: { likes: 7400, comments: 960 }
    },
    3
  );

  await prisma.timelineEntry.createMany({
    data: [
      {
        eventId: event.id,
        sourceId: sourceReport.id,
        title: "举报帖发布",
        body: "举报人 C 发布长文，事件开始在多个平台传播。",
        happenedAt: new Date("2026-04-08T07:30:00Z"),
        sortOrder: 1
      },
      {
        eventId: event.id,
        sourceId: sourceSchool.id,
        title: "学校发布情况说明",
        body: "学校称成立工作组并启动材料核验。",
        happenedAt: new Date("2026-04-10T12:00:00Z"),
        sortOrder: 2
      },
      {
        eventId: event.id,
        sourceId: sourceBili.id,
        title: "公开资料解读视频出现",
        body: "视频账号整理公开时间线，强调避免传播身份信息。",
        happenedAt: new Date("2026-04-12T15:30:00Z"),
        sortOrder: 3
      },
      {
        eventId: event.id,
        sourceId: sourceMedia.id,
        title: "媒体跟进调查进度",
        body: "媒体报道确认学校工作组和双方回应，未给出事实结论。",
        happenedAt: new Date("2026-04-14T10:00:00Z"),
        sortOrder: 4
      }
    ]
  });

  const evidenceReport = await prisma.evidenceItem.create({
    data: {
      eventId: event.id,
      sourceId: sourceReport.id,
      title: "举报帖原始页面",
      description: "举报人 C 公开长文页面，证明举报说法和发布时间。",
      evidenceKind: "POST",
      reliabilityLevel: "B_DIRECT",
      externalUrl: sourceReport.url
    }
  });
  const evidenceSchool = await prisma.evidenceItem.create({
    data: {
      eventId: event.id,
      sourceId: sourceSchool.id,
      title: "学校情况说明网页",
      description: "学校发布的情况说明，证明校方已启动调查流程。",
      evidenceKind: "DOCUMENT",
      reliabilityLevel: "A_STRONG",
      externalUrl: sourceSchool.url
    }
  });
  const evidenceMedia = await prisma.evidenceItem.create({
    data: {
      eventId: event.id,
      sourceId: sourceMedia.id,
      title: "媒体跟进报道页面",
      description: "媒体对调查进度和双方回应的转述，需要与原始材料分开标注。",
      evidenceKind: "ARTICLE",
      reliabilityLevel: "C_INDIRECT",
      externalUrl: sourceMedia.url
    }
  });

  const claimInvestigation = await prisma.claim.create({
    data: {
      eventId: event.id,
      claimantActorId: university.id,
      sourceId: sourceSchool.id,
      title: "学校已启动工作组",
      statement: "学校说明称已成立工作组核验材料。",
      status: "SUPPORTED",
      importance: "KEY"
    }
  });
  const claimTimeline = await prisma.claim.create({
    data: {
      eventId: event.id,
      claimantActorId: reporter.id,
      sourceId: sourceReport.id,
      title: "关于校内沟通时间线的说法",
      statement: "举报人 C 称曾在公开发帖前通过校内渠道反映。",
      status: "DISPUTED",
      importance: "KEY"
    }
  });
  const claimMedia = await prisma.claim.create({
    data: {
      eventId: event.id,
      sourceId: sourceMedia.id,
      title: "媒体确认调查尚未结束",
      statement: "媒体报道称学校工作组仍在调查，尚未发布最终结论。",
      status: "SUPPORTED",
      importance: "KEY"
    }
  });

  await prisma.claimEvidenceLink.createMany({
    data: [
      {
        claimId: claimInvestigation.id,
        evidenceId: evidenceSchool.id,
        relationType: "SUPPORTS",
        notes: "学校情况说明直接支持该流程事实。"
      },
      {
        claimId: claimTimeline.id,
        evidenceId: evidenceReport.id,
        relationType: "SUPPORTS",
        notes: "支持举报人曾作出该陈述，不证明所有时间点已被外部核验。"
      },
      {
        claimId: claimMedia.id,
        evidenceId: evidenceMedia.id,
        relationType: "SUPPORTS",
        notes: "媒体跟进报道支持调查仍在进行的状态。"
      }
    ]
  });

  await prisma.eventVersion.create({
    data: {
      eventId: event.id,
      versionNumber: 1,
      snapshotBefore: {},
      snapshotAfter: publicSnapshot(event),
      changeSummary: "创建首版校园举报事件档案，纳入官方说明、当事人陈述与媒体跟进。",
      createdByUserId: adminId
    }
  });

  return event;
}

async function main() {
  await clearData();

  const admin = await prisma.user.create({
    data: {
      email: "editor@example.org",
      displayName: "馆长",
      role: "ADMIN"
    }
  });

  const relationshipTopic = await prisma.topic.create({
    data: {
      slug: "relationship-public-disputes",
      name: "婚恋与公共争议",
      description: "记录婚恋纠纷进入公共讨论后的信息传播、回应与纠错过程。"
    }
  });
  const campusTopic = await prisma.topic.create({
    data: {
      slug: "campus-public-disputes",
      name: "校园公共争议",
      description: "记录校园举报、学校回应、调查进度与隐私保护要求。"
    }
  });

  const tags = await Promise.all(
    [
      ["gender-discourse", "性别议题"],
      ["public-opinion-reversal", "舆论反转"],
      ["platform-response", "平台介入"],
      ["privacy-protection", "隐私保护"],
      ["campus", "校园争议"],
      ["media-follow-up", "媒体跟进"]
    ].map(([slug, label]) => prisma.tag.create({ data: { slug, label } }))
  );
  const tagBySlug = new Map(tags.map((tag) => [tag.slug, tag.id]));

  const first = await seedMarriageDispute(admin.id, relationshipTopic.id, [
    tagBySlug.get("gender-discourse")!,
    tagBySlug.get("public-opinion-reversal")!,
    tagBySlug.get("platform-response")!,
    tagBySlug.get("privacy-protection")!
  ]);
  const second = await seedCampusCase(admin.id, campusTopic.id, [
    tagBySlug.get("campus")!,
    tagBySlug.get("gender-discourse")!,
    tagBySlug.get("privacy-protection")!,
    tagBySlug.get("media-follow-up")!
  ]);

  await prisma.auditLog.createMany({
    data: [
      {
        userId: admin.id,
        entityType: "Event",
        entityId: first.id,
        action: "PUBLISHED",
        metadata: { seed: true }
      },
      {
        userId: admin.id,
        entityType: "Event",
        entityId: second.id,
        action: "PUBLISHED",
        metadata: { seed: true }
      }
    ]
  });

  console.log(`Seeded events: ${first.slug}, ${second.slug}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
