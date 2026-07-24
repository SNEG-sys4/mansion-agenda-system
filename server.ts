import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import mammoth from "mammoth";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  const BASE_PATH = process.env.BASE_PATH || "";

  // Initialize Gemini SDK with User-Agent for tracking
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  // API endpoint to parse past general meeting minutes
  app.post(`${BASE_PATH}/api/parse-minutes`, async (req, res) => {
    try {
      const { text, fileBase64, mimeType, fileName } = req.body;

      let contents: any[] = [];
      const geminiPrompt = `あなたは分譲マンション管理組合の専門家（マンション管理士・分譲マンション管理会社フロント社員）です。
提供された総会の議事録・決議報告（テキスト、またはPDF/ドキュメント等）を注意深く解析し、マンション名、開催された期、開催日、全体の概要、各議案ごとの決議結果、および「過去の決議で次回以降に引き継がれた宿題や、段階的な値上げの約束、長期的な義務」など【整合性チェックにおいて重要なポイント】を構造化して抽出してください。
PDFの画像スキャンや形式の場合は、文字を正確に読み取り（OCR）、漏れなく内容を把握してください。`;

      if (fileBase64 && mimeType === "application/pdf") {
        // Pass PDF directly to Gemini-3.5-flash which natively supports PDF and does outstanding visual OCR/parsing
        contents = [
          {
            inlineData: {
              data: fileBase64,
              mimeType: "application/pdf"
            }
          },
          {
            text: geminiPrompt
          }
        ];
      } else {
        // Parse word document or plain text
        let extractedText = text || "";
        if (fileBase64 && (mimeType?.includes("wordprocessingml") || fileName?.endsWith(".docx") || fileName?.endsWith(".doc") || mimeType?.includes("application/msword"))) {
          try {
            const buffer = Buffer.from(fileBase64, "base64");
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          } catch (err: any) {
            console.error("Mammoth DOCX parsing failed:", err);
            return res.status(500).json({ error: "Wordドキュメントのテキスト抽出に失敗しました。" });
          }
        } else if (fileBase64 && (mimeType?.startsWith("text/") || fileName?.endsWith(".txt"))) {
          extractedText = Buffer.from(fileBase64, "base64").toString("utf-8");
        }

        if (!extractedText.trim()) {
          return res.status(400).json({ error: "解析する議事録のテキストまたはファイルを送信してください。" });
        }

        contents = [
          {
            text: `${geminiPrompt}

議事録テキスト：
${extractedText}`
          }
        ];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["condoName", "term", "date", "summary", "resolutions", "keyContradictionPoints"],
            properties: {
              condoName: {
                type: Type.STRING,
                description: "議事録から読み取れるマンション名・管理組合名。不明な場合は'不明なマンション'等とする。",
              },
              term: {
                type: Type.INTEGER,
                description: "第何期の総会か（数字のみ。例: 24）",
              },
              date: {
                type: Type.STRING,
                description: "総会の開催日（YYYY-MM-DD形式。不明な場合は大体の推測、または空欄）",
              },
              summary: {
                type: Type.STRING,
                description: "この期の総会で決定されたことや特色などの簡潔な全体要約（150文字程度）",
              },
              resolutions: {
                type: Type.ARRAY,
                description: "この総会で上程された議案ごとの決議状況",
                items: {
                  type: Type.OBJECT,
                  required: ["id", "agendaTitle", "contentSummary", "isApproved", "detail"],
                  properties: {
                    id: { type: Type.STRING, description: "議案の一意の識別子（例: res_1, res_2）" },
                    agendaTitle: { type: Type.STRING, description: "議案のタイトル（例: 第1号議案 管理業務報告及び決算報告、第2号議案 〇〇修繕に関する件など）" },
                    contentSummary: { type: Type.STRING, description: "議案内容と決議結果の要約" },
                    isApproved: { type: Type.BOOLEAN, description: "この議案が承認または可決されたかどうか" },
                    detail: { type: Type.STRING, description: "決議時に付記された意見、条件、今後の約束など重要な詳細" },
                  },
                },
              },
              keyContradictionPoints: {
                type: Type.ARRAY,
                description: "将来（将来の期や将来の予算など）の整合性確認において論点となりうる具体的な決議決定事項や、繰り延べされた課題、任期等（例: 『次回予算より管理費を値上げする』や『役員の任期は2年とする。今回の役員は24〜25期の2年間』『大規模修繕は次の26期に行う』など、明確な約束・条件）。",
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsedData = JSON.parse(response.text || "{}");
      res.json({ success: true, data: parsedData });
    } catch (error: any) {
      console.error("Parse minutes error:", error);
      res.status(500).json({ error: error?.message || "議事録の解析に失敗しました。" });
    }
  });

  // API endpoint to generate next term's draft agendas
  app.post(`${BASE_PATH}/api/generate-draft`, async (req, res) => {
    try {
      const { condoName, term, targetDate, pastMinutesList, focusPoints, defaultAgendas } = req.body;

      const pastContextStr = pastMinutesList && pastMinutesList.length > 0
        ? pastMinutesList.map((m: any) => {
            return `【第${m.term}期総会（開催日: ${m.date}）の決議事項】
- 要約: ${m.summary}
- 重要な将来の論点:
${m.keyContradictionPoints?.map((p: string) => `  * ${p}`).join("\n")}
- 議案決議詳細:
${m.resolutions?.map((r: any) => `  * ${r.agendaTitle} (決議: ${r.isApproved ? "可決" : "否決"}): ${r.detail}`).join("\n")}
`;
          }).join("\n\n")
        : "過去の議事録データはありません。";

      const prompt = `あなたはプロのマンション管理士及びマンション管理会社の一流フロント担当者です。
マンション管理組合の第${term}期総会に向けた「議案書」のドラフトを作成してください。

■ 対象マンション: ${condoName}
■ 今回作成する期: 第${term}期 定時総会
■ 開催予定日: ${targetDate}
■ 今回の重点的に盛り込む事項・議論テーマ：
${focusPoints || "特になし"}

■ 過去の総会議事録から受け継がれたコンテキスト（決議・経過）：
${pastContextStr}

■ 作成する議案の基本リスト（これを下敷きにしてマンションの実情に合わせて詳細化してください）：
${defaultAgendas && defaultAgendas.length > 0 ? defaultAgendas.map((da: string) => `- ${da}`).join("\n") : "・収支決算報告\n・今期事業計画および予算案\n・役員選任"}

過去の決議事項や宿題（修繕引当金の段階的引き上げ合意、管理費見直し、役員任期など）がある場合は、それを織り込んだり、理由書で裏付けるような表現を含めてください。
ドラフトは、実務で管理会社が管理組合総会向けに配布する「総会議案書」の最もフォーマルで分かりやすい文体（敬体：〜いたします、〜です、〜となります）で作成してください。

各議案(agenda)についての出力項目は以下の通りです：
- id: 新規議案ID (例: draft_1, draft_2)
- title: 議案の正式名称 (例: 第1号議案 第${term}期管理業務報告及び収支決算報告承認の件)
- proposer: 提案者 (例: 理事会, 理事長)
- reason: 提案理由（なぜこの議案が上程されるのか、背景や必要性。丁寧なマンション管理実務に即した解説）
- content: 議案の内容（決議を求める中身。数字の変更、任期や役員名、工事の概要、契約更新の内容など、詳細に説明する長文テキスト。必要に応じて箇条書きや丁寧な説明を含めてください。）
- type: 議案の種類（"settlement" (決算/報告), "budget" (予算案), "personnel" (役員改選), "contract" (契約更新/管理委託), "repair" (修繕/工事), "general" (その他一般議案) のいずれか）
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["term", "targetDate", "agendas"],
            properties: {
              term: { type: Type.INTEGER },
              targetDate: { type: Type.STRING },
              agendas: {
                type: Type.ARRAY,
                description: "作成された議案ドラフトの一覧",
                items: {
                  type: Type.OBJECT,
                  required: ["id", "title", "proposer", "reason", "content", "type"],
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    proposer: { type: Type.STRING },
                    reason: { type: Type.STRING, description: "提案理由。実務のプロとしての詳細な解説付きのもの。" },
                    content: { type: Type.STRING, description: "具体的な議決内容・実施要領を含む、実務上の議案内容そのもののテキスト。" },
                    type: { type: Type.STRING, enum: ["settlement", "budget", "personnel", "contract", "repair", "general"] },
                  },
                },
              },
            },
          },
        },
      });

      const generatedData = JSON.parse(response.text || "{}");
      res.json({ success: true, data: generatedData });
    } catch (error: any) {
      console.error("Generate draft error:", error);
      res.status(500).json({ error: error?.message || "議案書の作成に失敗しました。" });
    }
  });

  // API endpoint to perform automated consistency check between generated drafts and past minutes
  app.post(`${BASE_PATH}/api/check-consistency`, async (req, res) => {
    try {
      const { condoName, term, agendas, pastMinutesList } = req.body;

      const draftStr = agendas && agendas.length > 0
        ? agendas.map((a: any) => `【${a.title}】
提案者: ${a.proposer}
提案理由: ${a.reason}
議案内容: ${a.content}
`).join("\n\n")
        : "作成された議案はありません。";

      const pastContextStr = pastMinutesList && pastMinutesList.length > 0
        ? pastMinutesList.map((m: any) => {
            return `【第${m.term}期総会（開催日: ${m.date}）の決議事項・宿題】
- 全体要約: ${m.summary}
- 整合性チェック用重要ポイント:
${m.keyContradictionPoints?.map((p: string) => `  * ${p}`).join("\n")}
- 議案決議詳細:
${m.resolutions?.map((r: any) => `  * ${r.agendaTitle} (決議: ${r.isApproved ? "可決" : "否決"}): ${r.detail}`).join("\n")}
`;
          }).join("\n\n")
        : "過去の議事録データはありません。";

      const prompt = `あなたはプロのマンション管理士及びマンション管理組合のコンプライアンス監査員です。
管理組合の「今回作成した総会議案書のドラフト」と、「過去の総会議事録（決議事項、未決・継続案件、中長期の宿題、期・任期のルール）」を厳密に照合し、過去の公的な決定事項、約束、または一般的な管理規約に照らし合わせて、矛盾・整合性エラー・上程漏れがないかを自動で検証してください。

マンション名: ${condoName}
現在検討中の総会: 第${term}期総会

■ 過去の議事録・継続宿題の情報：
${pastContextStr}

■ 今回作成した総会議案書ドラフト：
${draftStr}

不整合（矛盾）となりやすい主な観点：
1. 【資金面の不整合】: 過去の総会で「修繕積立金を毎年3%ずつ引き上げる」「第X期より月額〇〇円に増額する」などと決定しているのに、今回の決算・予算案で反映されていない場合（または金額が合わない）。
2. 【任期の不整合】: 役員の任期が例えば「2年（改選は隔年）」と定められて一昨期に就任しているのに、今回の総会で不要な役員改任議案があがっている、あるいは逆に今年が改選期であるのに役員選任議案が漏れている等。
3. 【契約・委託の不整合】: 管理委託契約の更新で、契約期間や委託料金が過去の決議、または前回の更新内容とズレていたり矛盾している。
4. 【持ち越し案件・宿題の漏れ】: 前期に「今期継続審議とする」「〇〇を来期総会に提案する」と決められた重大決議（またはその付帯意見や要望）が、今回の検討議案に含まれていない場合。
5. 【その他】: 法的矛盾（例: 理事報酬の変更、規約改正手続き等で必要とされる要件）など。

整合性の解析結果を、警告として構造化して出力してください。矛盾が見つからなくても、安全上のアドバイスを数点出力してください。
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["hasInconsistencies", "inconsistencies"],
            properties: {
              hasInconsistencies: {
                type: Type.BOOLEAN,
                description: "注意・重大な不整合や提案事項が1つでもある場合はtrue、無ければfalse",
              },
              inconsistencies: {
                type: Type.ARRAY,
                description: "検出された不整合・注意点、または安全確認アドバイスのリスト",
                items: {
                  type: Type.OBJECT,
                  required: ["id", "severity", "type", "title", "description", "pastResolutionReference", "recommendation"],
                  properties: {
                    id: { type: Type.STRING },
                    severity: {
                      type: Type.STRING,
                      enum: ["high", "medium", "low", "info"],
                      description: "重大度：high(致命的・予算矛盾等), medium(要対応・任期等), low(注意レベル), info(アドバイス・良好)",
                    },
                    type: {
                      type: Type.STRING,
                      enum: ["financial", "personnel", "contract", "repair", "general"],
                    },
                    title: { type: Type.STRING, description: "不整合・確認事項の簡潔なタイトル" },
                    description: { type: Type.STRING, description: "なぜ不整合であるか、またはどのような矛盾が発生しているかの明確な説明" },
                    pastResolutionReference: { type: Type.STRING, description: "過去のどの議事録・どの部分を論拠としたか（例: 第23期総会議案『第2号議案修繕費改定の件』）" },
                    recommendation: { type: Type.STRING, description: "管理フロントがどうやってこの矛盾を解決すべきか（予算書金額の修正、任期変更、宿題議案の追加等）の具体的なアドバイス" },
                  },
                },
              },
            },
          },
        },
      });

      const checkResults = JSON.parse(response.text || "{}");
      res.json({ success: true, data: checkResults });
    } catch (error: any) {
      console.error("Check consistency error:", error);
      res.status(500).json({ error: error?.message || "整合性チェックに失敗しました。" });
    }
  });


  // API endpoint to support downstream rewriting of management contract / rules / important explanation after minutes are uploaded
  app.post(`${BASE_PATH}/api/rewrite-support`, async (req, res) => {
    try {
      const {
        condoName,
        docType,
        documentText,
        fileBase64,
        mimeType,
        fileName,
        currentDraft,
        latestMinutes,
        pastMinutesList,
      } = req.body;

      const docTypeLabelMap: Record<string, string> = {
        currentContract: "現行管理委託契約",
        managementRules: "管理規約",
        importantExplanation: "重要事項説明書",
        other: "その他関連文書",
      };
      const docTypeLabel = docTypeLabelMap[docType] || "関連文書";

      const draftStr = currentDraft?.agendas?.length
        ? currentDraft.agendas.map((a: any) => `【${a.title}】
提案者: ${a.proposer}
提案理由: ${a.reason}
議案内容: ${a.content}
`).join("\n\n")
        : "議案書ドラフトはありません。";

      const minutesStr = pastMinutesList?.length
        ? pastMinutesList.map((m: any) => `【第${m.term}期総会議事録 / ${m.date || "日付不明"}】
要約: ${m.summary}
重要ポイント:
${m.keyContradictionPoints?.map((p: string) => `- ${p}`).join("\n") || ""}
決議詳細:
${m.resolutions?.map((r: any) => `- ${r.agendaTitle}（${r.isApproved ? "可決" : "否決"}）: ${r.detail || r.contentSummary}`).join("\n") || ""}
`).join("\n\n")
        : "登録済み議事録はありません。";

      let extractedText = documentText || "";
      let contents: any[] = [];

      const promptBase = `あなたはマンション管理会社の契約・規約改定支援の専門家です。
以下の情報を照合し、総会議案書作成後にアップロードされた総会議事録の決議内容を踏まえて、後工程で必要となる「現行管理委託契約」「管理規約」「重要事項説明書」等の書き換えを支援してください。

対象マンション: ${condoName}
確認対象文書: ${docTypeLabel}

■ 今回の総会議案書ドラフト:
${draftStr}

■ 登録済み総会議事録ナレッジ:
${minutesStr}

■ 最新議事録:
${latestMinutes ? `第${latestMinutes.term}期 / ${latestMinutes.date || "日付不明"} / ${latestMinutes.summary || ""}` : "未指定"}

判定方針:
1. 決議済み事項と現行文書の齟齬を抽出する。
2. 管理委託料、契約期間、委託業務範囲、管理規約条文、重要事項説明書の説明内容に影響する事項を優先する。
3. すぐに条文確定せず、管理会社・理事会・専門家が確認すべき「書き換え候補」として出す。
4. 法的判断の確定ではなく、実務上のレビュー補助として表現する。
5. 影響がない場合も、その理由と保留すべき確認事項を示す。`;

      if (fileBase64 && mimeType === "application/pdf") {
        contents = [
          { inlineData: { data: fileBase64, mimeType: "application/pdf" } },
          { text: `${promptBase}\n\n上記PDFが確認対象の現行文書です。PDF本文を読んで影響箇所を抽出してください。` },
        ];
      } else {
        if (fileBase64 && (mimeType?.includes("wordprocessingml") || fileName?.endsWith(".docx") || fileName?.endsWith(".doc") || mimeType?.includes("application/msword"))) {
          try {
            const buffer = Buffer.from(fileBase64, "base64");
            const result = await mammoth.extractRawText({ buffer });
            extractedText = result.value;
          } catch (err: any) {
            console.error("Mammoth downstream document parsing failed:", err);
            return res.status(500).json({ error: "確認対象文書のWordテキスト抽出に失敗しました。" });
          }
        } else if (fileBase64 && (mimeType?.startsWith("text/") || fileName?.endsWith(".txt"))) {
          extractedText = Buffer.from(fileBase64, "base64").toString("utf-8");
        }

        if (!extractedText.trim()) {
          return res.status(400).json({ error: "確認対象文書のテキストまたはファイルを送信してください。" });
        }

        contents = [
          {
            text: `${promptBase}

■ 確認対象文書本文:
${extractedText}`,
          },
        ];
      }

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["summary", "impactedDocuments", "requiredChanges", "recommendedNextActions", "warnings"],
            properties: {
              summary: { type: Type.STRING, description: "全体所見。後工程でどの程度の書き換えが必要かを簡潔に説明する。" },
              impactedDocuments: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["documentType", "impactLevel", "reason"],
                  properties: {
                    documentType: { type: Type.STRING },
                    impactLevel: { type: Type.STRING, enum: ["high", "medium", "low", "none"] },
                    reason: { type: Type.STRING },
                  },
                },
              },
              requiredChanges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["targetDocument", "clauseOrSection", "currentIssue", "suggestedRevision", "sourceResolution"],
                  properties: {
                    targetDocument: { type: Type.STRING },
                    clauseOrSection: { type: Type.STRING },
                    currentIssue: { type: Type.STRING },
                    suggestedRevision: { type: Type.STRING },
                    sourceResolution: { type: Type.STRING },
                  },
                },
              },
              recommendedNextActions: { type: Type.ARRAY, items: { type: Type.STRING } },
              warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
          },
        },
      });

      const result = JSON.parse(response.text || "{}");
      res.json({ success: true, data: result });
    } catch (error: any) {
      console.error("Rewrite support error:", error);
      res.status(500).json({ error: error?.message || "後工程支援レポートの生成に失敗しました。" });
    }
  });

  // Vite middleware for development or serving index.html in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(BASE_PATH, express.static(distPath));
    app.get(`${BASE_PATH}/*`, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.get(BASE_PATH, (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
