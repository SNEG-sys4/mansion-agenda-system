import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel, WidthType, BorderStyle } from "docx";

export interface AgendaDraft {
  id: string;
  title: string;
  proposer: string;
  reason: string;
  content: string;
  type: "settlement" | "budget" | "personnel" | "contract" | "repair" | "general";
}

export interface PastResolution {
  id: string;
  agendaTitle: string;
  contentSummary: string;
  isApproved: boolean;
  detail: string;
}

export interface PastMinutes {
  id: string;
  condoName: string;
  term: number;
  date: string;
  summary: string;
  resolutions: PastResolution[];
  keyContradictionPoints: string[];
}

export interface ConsistencyIssue {
  id: string;
  severity: "high" | "medium" | "low" | "info";
  type: string;
  title: string;
  description: string;
  pastResolutionReference: string;
  recommendation: string;
}

export async function generateDocxFile(
  condoName: string,
  term: number,
  targetDate: string,
  agendas: AgendaDraft[],
  consistencyIssues: ConsistencyIssue[],
  includeIssuesInDoc: boolean = false
): Promise<Blob> {
  // Define standard styling options
  const fontMain = "MS Mincho";
  const fontGothic = "MS Gothic";

  const paragraphs: (Paragraph | Table)[] = [];

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================

  // Empty spaces for layout padding
  for (let i = 0; i < 5; i++) {
    paragraphs.push(new Paragraph(""));
  }

  // Condo title
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `第 ${term} 期 定 時 総 会 議 案 書`,
          size: 52, // 26pt
          bold: true,
          font: fontGothic,
        }),
      ],
    })
  );

  for (let i = 0; i < 2; i++) {
    paragraphs.push(new Paragraph(""));
  }

  // Condo name
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `${condoName} 管理組合`,
          size: 36, // 18pt
          bold: true,
          font: fontGothic,
        }),
      ],
    })
  );

  for (let i = 0; i < 12; i++) {
    paragraphs.push(new Paragraph(""));
  }

  // Cover footer (notice/date/host)
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `【開催予定日】   ${targetDate || "令和 年 月 日"} (予定)`,
          size: 24, // 12pt
          font: fontMain,
        }),
      ],
    })
  );

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `【作成元】  ${condoName} 理事会`,
          size: 24, // 12pt
          font: fontMain,
        }),
      ],
    })
  );

  // Page break for Next Page
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: "", break: 1 })],
    })
  );

  // ==========================================
  // PAGE 2: CONVOCATION NOTICE (招集通知)
  // ==========================================
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `第 ${term} 期 定時総会招集のご案内`,
          size: 32, // 16pt
          bold: true,
          font: fontGothic,
        }),
      ],
    })
  );

  paragraphs.push(new Paragraph(""));

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `区分所有者並びに議決権行使者 各位`,
          size: 21, // 10.5pt
          font: fontMain,
        }),
      ],
    })
  );

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `${condoName} 管理組合`,
          size: 21,
          font: fontMain,
          bold: true,
        }),
      ],
    })
  );

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `理事長  __________________  印`,
          size: 21,
          font: fontMain,
        }),
      ],
    })
  );

  paragraphs.push(new Paragraph(""));

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `拝啓  組合員の皆様におかれましては、益々ご清栄のこととお慶び申し上げます。平素は管理組合運営にご理解とご協力を賜り、厚く御礼申し上げます。`,
          size: 21,
          font: fontMain,
        }),
      ],
    })
  );

  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `さて、当管理組合の規約に基づき、第 ${term} 期の決算報告、予算、及び重要管理事項の審議決議を行うため、下記の通り定時総会を招集いたします。万一ご欠席される場合は、同封の委任状または議決権行使書をご提出いただきますよう、お願い申し上げます。`,
          size: 21,
          font: fontMain,
        }),
      ],
    })
  );

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `敬具`,
          size: 21,
          font: fontMain,
        }),
      ],
    })
  );

  paragraphs.push(new Paragraph(""));

  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `記`,
          size: 24,
          bold: true,
          font: fontGothic,
        }),
      ],
    })
  );

  paragraphs.push(new Paragraph(""));

  // Guide table / details
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: `１．開催日時:    ${targetDate || "令和 年 月 日 (曜日)  10時00分より"} `, size: 22, font: fontMain, bold: true }),
      ],
    })
  );
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: `２．開催場所:    本マンション集会室、またはWEB開催会場`, size: 22, font: fontMain, bold: true }),
      ],
    })
  );
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({ text: `３．審議議案:`, size: 22, font: fontMain, bold: true }),
      ],
    })
  );

  // List of Agendas on Invitation
  agendas.forEach((agenda, idx) => {
    paragraphs.push(
      new Paragraph({
        indent: { left: 720 }, // ~1.27cm
        children: [
          new TextRun({
            text: `・${agenda.title}`,
            size: 21,
            font: fontMain,
          }),
        ],
      })
    );
  });

  paragraphs.push(new Paragraph(""));
  paragraphs.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `※ ご提出期日: 開催予定日の前日、17時00分までに管理人室またはポストへご投函ください。`,
          size: 18, // 9pt
          font: fontMain,
        }),
      ],
    })
  );

  // Page break for Agendas Details
  paragraphs.push(
    new Paragraph({
      children: [new TextRun({ text: "", break: 1 })],
    })
  );

  // ==========================================
  // PAGE 3+: DETAILED AGENDAS
  // ==========================================
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `総 会 上 呈 議 案 詳 細`,
          size: 28, // 14pt
          bold: true,
          font: fontGothic,
        }),
      ],
    })
  );

  paragraphs.push(new Paragraph(""));

  agendas.forEach((agenda, idx) => {
    // Agenda Header
    paragraphs.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun({
            text: `${agenda.title}`,
            size: 24, // 12pt
            bold: true,
            font: fontGothic,
          }),
        ],
      })
    );

    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `提案者: ${agenda.proposer || "理事会"}`,
            size: 18,
            font: fontMain,
            bold: true,
          }),
        ],
      })
    );

    paragraphs.push(new Paragraph(""));

    // Content inside a structured table for professional executive feel
    const table = new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: {
                size: 20,
                type: WidthType.PERCENTAGE,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "提案の趣旨・理由",
                      bold: true,
                      font: fontGothic,
                      size: 20,
                    }),
                  ],
                }),
              ],
              shading: {
                fill: "F2F2F2",
              },
            }),
            new TableCell({
              width: {
                size: 80,
                type: WidthType.PERCENTAGE,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: agenda.reason,
                      font: fontMain,
                      size: 20,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: {
                size: 20,
                type: WidthType.PERCENTAGE,
              },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "決議・提案内容",
                      bold: true,
                      font: fontGothic,
                      size: 20,
                    }),
                  ],
                }),
              ],
              shading: {
                fill: "F2F2F2",
              },
            }),
            new TableCell({
              width: {
                size: 80,
                type: WidthType.PERCENTAGE,
              },
              children: [
                agenda.content.split("\n").map(
                  (line) =>
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: line,
                          font: fontMain,
                          size: 20,
                        }),
                      ],
                      spacing: {
                        before: 100,
                        after: 100,
                      },
                    })
                ),
              ].flat(),
            }),
          ],
        }),
      ],
    });

    paragraphs.push(table);
    paragraphs.push(new Paragraph(""));

    // If it is not the last item, add a light divider / space or page break
    if (idx < agendas.length - 1) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: "──────────────────────────────────────────────" })],
        })
      );
      paragraphs.push(new Paragraph(""));
    }
  });

  // ==========================================
  // EXTRA: AUDIT / CONSISTENCY LOG (If user opted in)
  // ==========================================
  if (includeIssuesInDoc && consistencyIssues.length > 0) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: "", break: 1 })],
      })
    );

    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "【監査用付録】過去の議決事項との整合性監査レポート",
            size: 26,
            bold: true,
            font: fontGothic,
          }),
        ],
      })
    );

    paragraphs.push(new Paragraph(""));
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "※この付録は、システムによって自動的に解析・検証された過去の総会議事録との整合性検査レポートです。管理会社のフロント・理事長間の事前確認・チェック補助用途としてご活用ください。",
            size: 18,
            font: fontMain,
            color: "666666",
            italics: true,
          }),
        ],
      })
    );

    paragraphs.push(new Paragraph(""));

    consistencyIssues.forEach((issue) => {
      const severityColor =
        issue.severity === "high"
          ? "FF0000"
          : issue.severity === "medium"
          ? "FF8C00"
          : issue.severity === "low"
          ? "0000FF"
          : "008000";

      const severityText =
        issue.severity === "high"
          ? "[重大な不適合・予算差異・規約反]"
          : issue.severity === "medium"
          ? "[要確認・任期ズレ・継続宿題要検証]"
          : issue.severity === "low"
          ? "[注意・軽微な乖離]"
          : "[アドバイス・チェック完了]";

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${severityText} ${issue.title}`,
              font: fontGothic,
              size: 22,
              bold: true,
              color: severityColor,
            }),
          ],
        })
      );

      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          children: [
            new TextRun({ text: "不整合・確認事項の説明： ", bold: true, font: fontGothic, size: 18 }),
            new TextRun({ text: issue.description, font: fontMain, size: 18 }),
          ],
        })
      );

      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          children: [
            new TextRun({ text: "論拠となる過去決議の参照： ", bold: true, font: fontGothic, size: 18 }),
            new TextRun({ text: issue.pastResolutionReference, font: fontMain, size: 18, italics: true }),
          ],
        })
      );

      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          children: [
            new TextRun({ text: "推奨解決アクション： ", bold: true, font: fontGothic, size: 18 }),
            new TextRun({ text: issue.recommendation, font: fontMain, size: 18, color: "008000", bold: true }),
          ],
        })
      );

      paragraphs.push(new Paragraph(""));
    });
  }

  // Create document
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  return await Packer.toBlob(doc);
}
