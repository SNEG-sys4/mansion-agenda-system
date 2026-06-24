/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Building,
  FileText,
  Wand2,
  CheckCircle2,
  AlertTriangle,
  FileDown,
  Plus,
  Trash2,
  UploadCloud,
  History,
  ShieldCheck,
  Calendar,
  Layers,
  BookOpen,
  ArrowRight,
  Info,
  Edit2,
  Save,
  RotateCcw,
  Sparkles,
  RefreshCw,
  X,
  User,
  KeyRound,
  LogOut,
  Cloud
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  generateDocxFile,
  AgendaDraft,
  PastMinutes,
  PastResolution,
  ConsistencyIssue
} from "./utils/docxGenerator";

// Initial Demo Model Condo
const DEFAULT_CONDO = {
  id: "condo_1",
  name: "アンピール見本",
  address: "東京都港区高輪二丁目",
  totalUnits: 120,
  currentTerm: 25,
};

// Initial Demo Past Minutes
const DEFAULT_PAST_MINUTES: PastMinutes[] = [
  {
    id: "minutes_demo_1",
    condoName: "アンピール見本",
    term: 24,
    date: "2025-05-18",
    summary: "第24期定時総会。事業報告・収支報告・次期予算案が承認された。また、第23期に可決された『大規模修繕に向けた修繕積立金の段階的引き上げ（本第25期より月額3%増額）』の方針が再確認され、総会で承認された。役員の任期は2年（第24期・25期定時総会終了時まで）と定められ、高橋理事が理事長に留任、佐藤理事が監事に就任した。",
    resolutions: [
      {
        id: "res_1",
        agendaTitle: "第1号議案 第24期管理業務報告及び収支決算報告承認の件",
        contentSummary: "管理委託業務及び管理費、修繕積立金の収支決算が適正に処理されているものとして承認された。",
        isApproved: true,
        detail: "管理費会計は黒字。修繕積立金残高は1億4,500万円。"
      },
      {
        id: "res_2",
        agendaTitle: "第2号議案 第25期（今期）事業計画及び収支予算案承認の件",
        contentSummary: "第25期の事業計画及び予算案が承認された。次期（第25期）から修繕積立金改定(段階引上げ3%増)を反映して徴収する。",
        isApproved: true,
        detail: "来期からの積立金増額を確約。増額分の使途は2028年予定の大規模修繕資金として充当する。"
      },
      {
        id: "res_3",
        agendaTitle: "第3号議案 役員改選（選任）の件",
        contentSummary: "任期満了に伴い、高橋理事長を含む計5名が役員（任期2年：第24期〜第25期定時総会終結まで）として選出・承認された。",
        isApproved: true,
        detail: "任期が2年間となる。第25期（今年）の総会は改選期ではなく、第26期（来年）の総会が改選期となる約束とされている。"
      }
    ],
    keyContradictionPoints: [
      "修繕積立金は、第25期（今年）より段階値上げ（3%増額）を実施することが前々回（第23期）の総会で決議（約束）されている。",
      "第24期総会で選出された役員（理事長・高橋、監事・佐藤など）の任期は2年（第25期総会終結時まで）であるため、今回の第25期総会では全体改選などの役員選任議案は原則不要（または不要であるはず）とされている。",
      "管理会社である『新栄総合管理株式会社』との委託契約は、第25期の中旬に契約満了を迎えるため、今回の総会で委託料金および契約期間を定めた契約更新の上程（第25期満了まで等）が必要とされている。"
    ]
  }
];


type CondoRecord = typeof DEFAULT_CONDO;

type WorkspaceSnapshot = {
  workspaceVersion: string;
  condos: CondoRecord[];
  selectedCondoId: string;
  pastMinutes: PastMinutes[];
  targetTerm: number;
  targetDate: string;
  focusPoints: string;
  selectedDefaultTypes: Record<string, boolean>;
  budgetMode: "correct" | "mismatch";
  personnelReasonMode: "none" | "resignation";
  currentDraft: { term: number; targetDate: string; agendas: AgendaDraft[] } | null;
  consistencyIssues: ConsistencyIssue[];
  isAudited: boolean;
};

const ACCOUNT_REMEMBER_KEY = "mansion_agenda_active_account_v2";


export default function App() {
  // Tabs: 'dash' | 'past' | 'draft' | 'about'
  const [activeTab, setActiveTab] = useState<"dash" | "past" | "draft" | "about">("dash");

  const rememberedAccount = (() => {
    try {
      return JSON.parse(window.localStorage.getItem(ACCOUNT_REMEMBER_KEY) || "null") || {};
    } catch {
      return {};
    }
  })();

  // Account-scoped workspace state. Each property manager saves to an isolated account workspace.
  const [accountId, setAccountId] = useState(String(rememberedAccount.accountId || ""));
  const [accountDisplayName, setAccountDisplayName] = useState(String(rememberedAccount.accountDisplayName || ""));
  const [accountPin, setAccountPin] = useState("");
  const [isAccountReady, setIsAccountReady] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(false);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState("未保存");

  // State Management
  const [condos, setCondos] = useState([DEFAULT_CONDO]);
  const [selectedCondoId, setSelectedCondoId] = useState("condo_1");
  const [pastMinutes, setPastMinutes] = useState<PastMinutes[]>(DEFAULT_PAST_MINUTES);

  // New Draft settings
  const [targetTerm, setTargetTerm] = useState(25);
  const [targetDate, setTargetDate] = useState("2026-05-24");
  const [focusPoints, setFocusPoints] = useState(
    "1. 第23期に決めた修繕積立金の3%増額を今回の基本予算に正しく反映すること。\n2. 今期満了する管理委託契約の更新（委託額据え置き）。\n3. 今回は役員改選の年ではないため、特別な変更がない限り役員選任はスキップすること。"
  );
  const [selectedDefaultTypes, setSelectedDefaultTypes] = useState({
    settlement: true,
    budget: true,
    contract: true,
    personnel: false, // 改選期ではないため、デフォルトオフ。しかしユーザーがオンにして不整合を体験できるようにする
    repair: false,
    general: false,
  });

  // Visual strategy choices
  const [budgetMode, setBudgetMode] = useState<"correct" | "mismatch">("correct");
  const [personnelReasonMode, setPersonnelReasonMode] = useState<"none" | "resignation">("none");

  // Synchronously build standard agendas on client-side
  const buildPrefilledAgendas = (
    term: number,
    activeTypes: typeof selectedDefaultTypes,
    bMode: "correct" | "mismatch",
    pMode: "none" | "resignation"
  ): AgendaDraft[] => {
    const list: AgendaDraft[] = [];
    if (activeTypes.settlement) {
      list.push({
        id: "agenda_settlement",
        title: `第1号議案：第${term}期管理業務報告及び収支決算報告承認の件`,
        proposer: "理事会",
        reason: `第${term}期（前年度）における管理費会計及び修繕積立金会計の決算書類、ならびに業務報告書を監事による監査報告とともに上程し、組合員の皆様のご承認を仰ぐものです。`,
        content: `【決算報告概要】
1．管理費会計当期末残高：12,450,000円 (当期剰余金 650,000円)
2．修繕積立金会計当期末残高：145,000,000円
※詳細な収支決算書及び貸借対照表、並びに監事による『監査報告書』は別紙添付の通りです。`,
        type: "settlement"
      });
    }
    if (activeTypes.budget) {
      const contentStr = bMode === "correct" 
        ? `【収支予算案の計画概要】
1．管理費会計総額：12,600,000円 (設備保全諸点検・清掃費用等の支出)
2．修繕積立金月額改定：段階別引上げ（実質3%増額）を予定通り適用して徴収いたします。
※前々回（第23期）の定時総会の第2号議案において承認・可決された計画通り、第25期（今期）より月額3%の積立金段階値上げを実施し、長期大規模修繕に向けた資金力を確保するための正式計上です。`
        : `【収支予算案の計画概要】
1．管理費会計総額：12,600,000円 (設備保全諸点検・清掃費用等の支出)
2．修繕積立金月額改定：本年度は近年の物価高及び組合員の家計負担への急激な影響を考慮し、前年通り（据え置き・改定なし）の料金にて徴収をおこないます。
※当初予定されていた3%の段階引き上げ計画（第23期決議事項）は、今期の予算案においては一時的に保留といたします。`;

      list.push({
        id: "agenda_budget",
        title: `第2号議案：第${term + 1}期事業計画及び収支予算案承認の件`,
        proposer: "理事会",
        reason: `第${term + 1}期（翌年度）における管理費及び修繕積立金の収支計画、ならびに各種設備保守整備計画を定期的かつ円滑に執行するため、本予算案の上程ご承認をお願いするものです。`,
        content: contentStr,
        type: "budget"
      });
    }
    if (activeTypes.contract) {
      list.push({
        id: "agenda_contract",
        title: `第3号議案：管理委託契約の更新に関する件`,
        proposer: "理事会",
        reason: `弊マンションの管理委託先である『新栄総合管理株式会社』との委託業務契約が、第${term}期の中旬をもって期間満了となるため、同一の業務範囲・委託料金据え置きのうえ、契約期間を1年間（第${term + 1}期通常総会終結まで）として契約更新を締結いたしたく、ご承認を仰ぐものです。`,
        content: `【委託契約更新の条件】
1．受託管理業者：新栄総合管理株式会社
2．管理委託報酬：月額 450,000円（前年度から据え置き・変更なし）
3．契約期間：1年間（第${term + 1}期定期総会の終結する時までとする）
4．委託業務範囲：管理員受付、日常清掃業務、建物清掃・昇降機等設備点検、深夜対応`,
        type: "contract"
      });
    }
    if (activeTypes.personnel) {
      const contentStr = pMode === "resignation"
        ? `【新役員候補者】
・理事候補：高橋 一郎、鈴木 次郎、木村 花子、渡辺 三郎、小林 四郎
・監事候補：佐藤 茂
・選任理由：現監事の急遽の転出（売却）による補欠選任。任期は管理規約第45条に基づき、辞任した役員の残任期間（第25期定時総会終結まで）とします。`
        : `【新役員候補者一覧】
・理事長：山田 太郎
・副理事長：鈴木 一郎
・管理理事：佐藤 次郎、鈴木 三郎、木村 四郎
・監事：渡辺 監事
・就任期間：全役員につき、本総会終結時点から今後2年間（第${term + 2}期定期総会終結まで）の新たな新役員を全員選出・選任いたします。`;

      list.push({
        id: "agenda_personnel",
        title: `第4号議案：役員選任の件`,
        proposer: "理事会",
        reason: pMode === "resignation"
          ? `中途転出に伴う役員辞任が発生したため、規約に則り後任となる補欠役員の選任をお願いするものです。`
          : `役員全員を一度退任させ、新たな体制として理事及び監事の一式選出・承認を求めるものです。`,
        content: contentStr,
        type: "personnel"
      });
    }
    if (activeTypes.repair) {
      list.push({
        id: "agenda_repair",
        title: `第5号議案：高層給排水管設備更新工事実施の承認に関する件`,
        proposer: "理事会",
        reason: `当マンションの築年数が15年を超え、専有部・共用部給排水管の老朽化による赤水トラブルが見られるため、中長期修繕計画に基づいて給排水更生・ライニング工事を実施いたしたく、本件承認を仰ぐものです。`,
        content: `【修繕工事実施案】
1．施工箇所：共用立管、及び各戸専有部枝管の給排水管補修
2．施工会社：株式会社 大都都市設備開発
3．総工事費用：15,000,000円 (全額修繕積立金会計を取り崩して充当)
4．施行工期：2026年9月 〜 2026年12月`,
        type: "repair"
      });
    }
    if (activeTypes.general) {
      list.push({
        id: "agenda_general",
        title: `第6号議案：駐輪場規則及び不要物強制撤去基準の改定に関する件`,
        proposer: "理事会",
        reason: `エントランス及び駐輪スペースに、長年持ち主不明の放置自転車が多発しており、景観・防犯および他の居住者の平穏な利用に支障を与えています。これを法的に強制処分・整理できるよう駐輪場使用細則の一部条項のご改定をお願いするものです。`,
        content: `【駐輪細則の改定内容】
1．放置自転車の回収警告：告知から30日経過しても権利主張のない放置物を強制廃棄できる条項の追加。
2．駐輪許可シール発行手数料の改定：年間500円（変更なし、登録の徹底）。
3．施行日：2026年7月1日`,
        type: "general"
      });
    }
    return list;
  };

  const handleApplyTemplates = () => {
    const freshAgendas = buildPrefilledAgendas(targetTerm, selectedDefaultTypes, budgetMode, personnelReasonMode);
    setCurrentDraft({
      term: targetTerm,
      targetDate: targetDate,
      agendas: freshAgendas
    });
    // Reset auditing on edit
    setIsAudited(false);
    setConsistencyIssues([]);
  };

  const handleDownloadDocx = async (includeIssuesInDoc: boolean) => {
    try {
      const blob = await generateDocxFile(
        currentCondo.name,
        targetTerm,
        targetDate,
        currentDraft ? currentDraft.agendas : [],
        consistencyIssues,
        includeIssuesInDoc
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `第${targetTerm}期_${currentCondo.name}_総会議案書${includeIssuesInDoc ? "_監査付" : ""}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Docx generation error:", err);
      alert("Wordファイルの生成に失敗しました。");
    }
  };

  // Local/Programmatic Rule Checker
  const runLocalConsistencyCheck = (agendasList: AgendaDraft[]): ConsistencyIssue[] => {
    const issues: ConsistencyIssue[] = [];

    // Find if budget agenda exists
    const budgetAgenda = agendasList.find(a => a.type === "budget");
    if (budgetAgenda) {
      // Check if it suspends or freezes the raise
      const content = budgetAgenda.content || "";
      if (
        content.includes("据え置く") || 
        content.includes("変更なし") || 
        content.includes("引き上げは保留") || 
        content.includes("保留といたします") ||
        (!content.includes("3%増額") && !content.includes("3%の値上げ") && !content.includes("段階的増額") && !content.includes("改訂") && !content.includes("段階引上げ") && !content.includes("段階的引上げ"))
      ) {
        issues.push({
          id: "issue_budget_raise",
          severity: "high",
          type: "budget_mismatch",
          title: `【積立金決議違反】第${targetTerm}期通常予算における修繕積立金段階値上げ未反映`,
          description: `前々期通常総会（第23期）の第2号決議において承認された修繕積立金の段階引上げ計画「今第25期期より月額3%増額適用」という明示された財務スケジュールが、今期の予算案構成に反映されていません。本予算に値上げを計上しない場合、前々期の総会可決約束（将来の大規模修繕資金確保計画）に対する『総会決議違反』という重篤な法的瑕疵が生じ、将来の財政不足や不服区分所有者との訴訟リスクを招きます。`,
          pastResolutionReference: `第23期定時総会議事録 第2号決議：『修繕積立金を第25期より3%段階値上げにて徴収する。本件決定は第25期通常総会予算案において適用を義務付ける。』`,
          recommendation: `第2号議案「予算案」の決議内容に「昨年の決議に基づき、予定通り3%の段階引上げを適用した額にて徴収する」内容を追記・計上してください。`
        });
      }
    }

    // Check if personnel agenda exists
    const personnelAgenda = agendasList.find(a => a.type === "personnel");
    if (personnelAgenda) {
      const content = personnelAgenda.content || "";
      // If it doesn't mention resignation/exception or is standard reelection
      if (
        !(content.includes("補欠選任") || content.includes("急遽の転出") || content.includes("辞任した役員の残任期間") || content.includes("残任")) &&
        (content.includes("全員選出") || content.includes("2年間") || content.includes("山田 太郎") || content.includes("改選") || content.includes("山田太郎"))
      ) {
        issues.push({
          id: "issue_personnel_term",
          severity: "medium",
          type: "personnel_mismatch",
          title: `【役員任期矛盾】留任期（中間期）における「全員一斉改選議案」の上程手続き不適合`,
          description: `第24期定期総会で新任された役員（理事長・高橋、監事・佐藤など）は、管理組合会則により「任期2年」の継続期間中にあります。今第25期総会は「任期の留任中間年」であり、本来役員選任は不要な年です。理由の明記がない状態で「全員改選」を通常議案として上程・可決することは、管理規約の手続き違反となり、前決議の効力を侵害（または任期喪失の瑕疵）することになります。`,
          pastResolutionReference: `第24期定時総会議事録 第3号決議：『任期は2年（第24期総会終結から第25期総会終結までではなく、第26期総会終結まで）』。よって、今回の第25期総会では役員改選（選任）は原則不要。`,
          recommendation: `任期途中での退任者が発生した事情等（例：転出による中途辞任）を理由に追記の上での「補欠補充」に内容を限定してください。改選が不要であれば第4号役員選任議案の一切を除去（スキップ）してください。`
        });
      }
    }

    // Check if contract update is excluded
    const contractAgenda = agendasList.find(a => a.type === "contract");
    if (!contractAgenda) {
      issues.push({
        id: "issue_contract_blank",
        severity: "medium",
        type: "contract_omission",
        title: `【管理委託空白化リスク】満了期を迎える管理委託契約の更新議案の欠落`,
        description: `新栄総合管理（株）との管理委託契約は、今年（第25期内）をもって契約満了となります。今期中に更新契約の締結・可決を行わない場合、総会終結後にマンションの管理員駐在・設備保全業務の契約空白期間が生じ、各種点検の遅れや共用部賠償保険の管理水準不適合が招かれる法的トラブルが懸念されます。`,
        pastResolutionReference: `第24期定時総会議事録 第3号決議/契約書約定：『委託業務契約の存続期限は第25期定期総会承認の日までとする』。`,
        recommendation: `今期総会に第3号議案として「管理委託契約の更新に関する件」を追加するか、上程項目に復活させてください。`
      });
    }

    return issues;
  };

  // Current Working Draft (initialized as standard)
  const [currentDraft, setCurrentDraft] = useState<{
    term: number;
    targetDate: string;
    agendas: AgendaDraft[];
  } | null>(null);

  // Consistency check results
  const [consistencyIssues, setConsistencyIssues] = useState<ConsistencyIssue[]>([]);
  const [isAudited, setIsAudited] = useState(false);

  // Loading States
  const [isParsing, setIsParsing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Upload Minutes Paste Text Area
  const [minutesText, setMinutesText] = useState("");
  const [minutesFileName, setMinutesFileName] = useState("");
  const [minutesUploadTerm, setMinutesUploadTerm] = useState(23);
  const [minutesUploadDate, setMinutesUploadDate] = useState("2024-05-18");

  // File Upload states for Word/PDF/Txt
  const [uploadMode, setUploadMode] = useState<"file" | "text">("file");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState("");
  const [fileMimeType, setFileMimeType] = useState("");

  // Condo Modals & Form State (Avoids browser prompt freeze/block issues in iframe)
  const [isAddCondoOpen, setIsAddCondoOpen] = useState(false);
  const [isEditCondoOpen, setIsEditCondoOpen] = useState(false);
  
  // Form states for adding condo
  const [addCondoName, setAddCondoName] = useState("");
  const [addCondoUnits, setAddCondoUnits] = useState(50);
  const [addCondoTerm, setAddCondoTerm] = useState(1);
  
  // Form states for editing condo
  const [editCondoName, setEditCondoName] = useState("");
  const [editCondoUnits, setEditCondoUnits] = useState(120);
  const [editCondoTerm, setEditCondoTerm] = useState(25);

  const handleOpenAddCondo = () => {
    setAddCondoName("");
    setAddCondoUnits(50);
    setAddCondoTerm(1);
    setIsAddCondoOpen(true);
  };

  const handleCreateCondoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addCondoName.trim()) {
      alert("マンション名を入力してください。");
      return;
    }
    const newCondo = {
      id: "condo_" + Date.now(),
      name: addCondoName.trim(),
      address: "登録住所なし",
      totalUnits: Number(addCondoUnits) || 0,
      currentTerm: Number(addCondoTerm) || 1,
    };
    setCondos([...condos, newCondo]);
    setSelectedCondoId(newCondo.id);
    setTargetTerm(newCondo.currentTerm); // Sync term immediately
    setIsAddCondoOpen(false);
  };

  const handleOpenEditCondo = () => {
    if (!currentCondo) return;
    setEditCondoName(currentCondo.name);
    setEditCondoUnits(currentCondo.totalUnits);
    setEditCondoTerm(currentCondo.currentTerm);
    setIsEditCondoOpen(true);
  };

  const handleUpdateCondoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCondoName.trim()) {
      alert("マンション名を入力してください。");
      return;
    }
    const termValue = Number(editCondoTerm) || 1;
    setCondos(condos.map(c => c.id === selectedCondoId ? { 
      ...c, 
      name: editCondoName.trim(), 
      totalUnits: Number(editCondoUnits) || 0, 
      currentTerm: termValue
    } : c));
    setTargetTerm(termValue); // sync targetTerm of the app as well!
    setIsEditCondoOpen(false);
  };

  // Selected Condo details
  const currentCondo = condos.find(c => c.id === selectedCondoId) || condos[0];

  const buildWorkspaceSnapshot = (): WorkspaceSnapshot => ({
    workspaceVersion: "2026-06-23-account-isolated-v1",
    condos,
    selectedCondoId,
    pastMinutes,
    targetTerm,
    targetDate,
    focusPoints,
    selectedDefaultTypes,
    budgetMode,
    personnelReasonMode,
    currentDraft,
    consistencyIssues,
    isAudited,
  });

  const applyWorkspaceSnapshot = (workspace: Partial<WorkspaceSnapshot> | null) => {
    const nextCondos = Array.isArray(workspace?.condos) && workspace!.condos.length > 0
      ? workspace!.condos
      : [DEFAULT_CONDO];
    const nextSelectedCondoId = workspace?.selectedCondoId && nextCondos.some(c => c.id === workspace.selectedCondoId)
      ? workspace.selectedCondoId
      : nextCondos[0].id;
    const selectedCondo = nextCondos.find(c => c.id === nextSelectedCondoId) || nextCondos[0];
    const nextTargetTerm = Number(workspace?.targetTerm || selectedCondo.currentTerm || DEFAULT_CONDO.currentTerm);
    const nextTargetDate = String(workspace?.targetDate || "2026-05-24");
    const nextSelectedDefaultTypes = {
      settlement: workspace?.selectedDefaultTypes?.settlement ?? true,
      budget: workspace?.selectedDefaultTypes?.budget ?? true,
      contract: workspace?.selectedDefaultTypes?.contract ?? true,
      personnel: workspace?.selectedDefaultTypes?.personnel ?? false,
      repair: workspace?.selectedDefaultTypes?.repair ?? false,
      general: workspace?.selectedDefaultTypes?.general ?? false,
    };
    const nextBudgetMode = workspace?.budgetMode === "mismatch" ? "mismatch" : "correct";
    const nextPersonnelReasonMode = workspace?.personnelReasonMode === "resignation" ? "resignation" : "none";

    setCondos(nextCondos);
    setSelectedCondoId(nextSelectedCondoId);
    setPastMinutes(Array.isArray(workspace?.pastMinutes) ? workspace!.pastMinutes : DEFAULT_PAST_MINUTES);
    setTargetTerm(nextTargetTerm);
    setTargetDate(nextTargetDate);
    setFocusPoints(String(workspace?.focusPoints || focusPoints));
    setSelectedDefaultTypes(nextSelectedDefaultTypes);
    setBudgetMode(nextBudgetMode);
    setPersonnelReasonMode(nextPersonnelReasonMode);
    setConsistencyIssues(Array.isArray(workspace?.consistencyIssues) ? workspace!.consistencyIssues : []);
    setIsAudited(Boolean(workspace?.isAudited));
    setCurrentDraft(workspace?.currentDraft || {
      term: nextTargetTerm,
      targetDate: nextTargetDate,
      agendas: buildPrefilledAgendas(nextTargetTerm, nextSelectedDefaultTypes, nextBudgetMode, nextPersonnelReasonMode)
    });
  };

  const handleLoginAccount = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setAccountError("");
    const cleanAccountId = accountId.trim();
    if (!cleanAccountId) {
      setAccountError("担当者アカウントIDを入力してください。");
      return;
    }
    if (accountPin.length < 4) {
      setAccountError("アカウント保護キーは4文字以上で入力してください。");
      return;
    }

    setIsLoadingAccount(true);
    try {
      const response = await fetch(import.meta.env.BASE_URL.replace(/\/$/,"") + "/api/workspace/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: cleanAccountId, accountPin })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "担当者ワークスペースを読み込めませんでした。");
      }
      applyWorkspaceSnapshot(result.workspace || null);
      const displayName = accountDisplayName.trim() || cleanAccountId;
      setAccountId(result.accountId || cleanAccountId);
      setAccountDisplayName(displayName);
      window.localStorage.setItem(ACCOUNT_REMEMBER_KEY, JSON.stringify({
        accountId: result.accountId || cleanAccountId,
        accountDisplayName: displayName
      }));
      setIsAccountReady(true);
      setSaveStatus(result.exists ? "保存済みワークスペースを読み込みました" : "新規ワークスペースを開始しました");
      setLastSavedAt(result.workspace?.savedAt || null);
    } catch (error: any) {
      setAccountError(error?.message || "担当者ワークスペースの読み込みに失敗しました。");
    } finally {
      setIsLoadingAccount(false);
    }
  };

  const handleSaveWorkspace = async () => {
    setAccountError("");
    if (!isAccountReady) {
      setAccountError("先に担当者アカウントで開始してください。");
      return;
    }
    setIsSavingWorkspace(true);
    try {
      const response = await fetch(import.meta.env.BASE_URL.replace(/\/$/,"") + "/api/workspace/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          accountPin,
          workspace: buildWorkspaceSnapshot()
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "保存できませんでした。");
      }
      setLastSavedAt(result.savedAt || new Date().toISOString());
      setSaveStatus("この担当者アカウント専用領域へ保存済み");
    } catch (error: any) {
      setAccountError(error?.message || "保存に失敗しました。");
      setSaveStatus("保存失敗");
    } finally {
      setIsSavingWorkspace(false);
    }
  };

  const handleLogoutAccount = () => {
    setIsAccountReady(false);
    setAccountPin("");
    setAccountError("");
    setSaveStatus("未保存");
  };

  // Drafts are no longer regenerated automatically on every term/date change.
  // This prevents another save or simple setting change from overwriting an edited draft.

  // Toggle individual agenda existence directly in real-time
  const handleToggleAgendaType = (type: keyof typeof selectedDefaultTypes) => {
    const nextVal = !selectedDefaultTypes[type];
    setSelectedDefaultTypes(prev => ({ ...prev, [type]: nextVal }));
    
    if (!currentDraft) return;
    if (nextVal) {
      const freshFull = buildPrefilledAgendas(targetTerm, { ...selectedDefaultTypes, [type]: true }, budgetMode, personnelReasonMode);
      const toAdd = freshFull.find(a => a.type === type);
      if (toAdd) {
        setCurrentDraft(prev => {
          if (!prev) return null;
          // Avoid duplicating if already exists
          if (prev.agendas.some(a => a.type === type)) return prev;
          return { ...prev, agendas: [...prev.agendas, toAdd] };
        });
      }
    } else {
      setCurrentDraft(prev => {
        if (!prev) return null;
        return { ...prev, agendas: prev.agendas.filter(a => a.type !== type) };
      });
    }
    setIsAudited(false);
  };

  // Change budget strategy visually
  const handleChangeBudgetStrategy = (mode: "correct" | "mismatch") => {
    setBudgetMode(mode);
    if (!currentDraft) return;
    const contentStr = mode === "correct"
      ? `【収支予算案の計画概要】
1．管理費会計総額：12,600,000円 (設備保全諸点検・清掃費用等の支出)
2．修繕積立金月額改定：段階別引上げ（実質3%増額）を予定通り適用して徴収いたします。
※前々回（第23期）の定時総会の第2号議案において承認・可決された計画通り、第25期（今期）より月額3%の積立金段階値上げを実施し、長期大規模修繕に向けた資金力を確保するための正式計上です。`
      : `【収支予算案の計画概要】
1．管理費会計総額：12,600,000円 (設備保全諸点検・清掃費用等の支出)
2．修繕積立金月額改定：本年度は近年の物価高及び組合員の家計負担への急激な影響を考慮し、前年通り（据え置き・改定なし）の料金にて徴収をおこないます。
※当初予定されていた3%の段階引き上げ計画（第23期決議事項）は、今期の予算案においては一時的に保留といたします。`;

    setCurrentDraft(prev => {
      if (!prev) return null;
      return {
        ...prev,
        agendas: prev.agendas.map(a => a.type === "budget" ? { ...a, content: contentStr } : a)
      };
    });
    setIsAudited(false);
  };

  // Change personnel strategy visually
  const handleChangePersonnelStrategy = (mode: "none" | "resignation") => {
    setPersonnelReasonMode(mode);
    if (!currentDraft) return;
    const contentStr = mode === "resignation"
      ? `【新役員候補者】
・理事候補：高橋 一郎、鈴木 次郎、木村 花子、渡辺 三郎、小林 四郎
・監事候補：佐藤 茂
・選任理由：現監事の急遽の転出（売却）による補欠選任。任期は管理規約第45条に基づき、辞任した役員の残任期間（第25期定時総会終結まで）とします。`
      : `【新役員候補者一覧】
・理事長：山田 太郎
・副理事長：鈴木 一郎
・管理理事：佐藤 次郎、鈴木 三郎、木村 四郎
・監事：渡辺 監事
・就任期間：全役員につき、本総会終結時点から今後2年間（第${targetTerm + 2}期定期総会終結まで）の新たな新役員を全員選出・選任いたします。`;

    const reasonStr = mode === "resignation"
      ? `中途転出に伴う役員辞任が発生したため、規約に則り後任となる補欠役員の選任をお願いするものです。`
      : `役員全員を一度退任させ、新たな体制として理事及び監事の一式選出・承認を求めるものです。`;

    setCurrentDraft(prev => {
      if (!prev) return null;
      return {
        ...prev,
        agendas: prev.agendas.map(a => a.type === "personnel" ? { ...a, content: contentStr, reason: reasonStr } : a)
      };
    });
    setIsAudited(false);
  };

  const handleMoveAgenda = (id: string, direction: "up" | "down") => {
    if (!currentDraft) return;
    const index = currentDraft.agendas.findIndex(a => a.id === id);
    if (index === -1) return;
    
    const newAgendas = [...currentDraft.agendas];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newAgendas.length) return;
    
    // Swap
    const temp = newAgendas[index];
    newAgendas[index] = newAgendas[targetIdx];
    newAgendas[targetIdx] = temp;
    
    setCurrentDraft({ ...currentDraft, agendas: newAgendas });
    setIsAudited(false);
  };

  const handleDeleteAgenda = (id: string) => {
    if (!currentDraft) return;
    
    // De-sync check box if a template item is deleted
    const target = currentDraft.agendas.find(a => a.id === id);
    if (target && target.type in selectedDefaultTypes) {
      setSelectedDefaultTypes(prev => ({ ...prev, [target.type]: false }));
    }
    
    const remaining = currentDraft.agendas.filter(a => a.id !== id);
    setCurrentDraft({ ...currentDraft, agendas: remaining });
    setIsAudited(false);
  };

  const handleUpdateAgendaText = (id: string, field: "title" | "reason" | "content", value: string) => {
    if (!currentDraft) return;
    const updatedAgendas = currentDraft.agendas.map(agenda => {
      if (agenda.id === id) {
        return { ...agenda, [field]: value };
      }
      return agenda;
    });
    setCurrentDraft({
      ...currentDraft,
      agendas: updatedAgendas
    });
    setIsAudited(false);
  };

  const handleAddCustomAgenda = () => {
    if (!currentDraft) return;
    const customId = "custom_" + Date.now();
    const newIdx = currentDraft.agendas.length + 1;
    const newAgenda: AgendaDraft = {
      id: customId,
      title: `第${newIdx}号議案：[新規追加の議案名称を入力してください]`,
      proposer: "理事会",
      reason: "上程の目的・理由（居住者への説明や法的根拠など）を入力してください。",
      content: "具体的な決議及び提案内容（工事予算、契約先、改定条文など）を入力してください。",
      type: "general"
    };
    
    setCurrentDraft({
      ...currentDraft,
      agendas: [...currentDraft.agendas, newAgenda]
    });
    setIsAudited(false);
  };

  // Handle new condo adding
  const handleAddCondo = () => {
    const name = prompt("マンション名・管理組合名を入力してください:");
    if (!name) return;
    const size = prompt("総戸数を入力してください:", "50");
    const term = prompt("現在の運営期(数字のみ)を入力してください:", "1");
    
    const newCondo = {
      id: "condo_" + Date.now(),
      name,
      address: "登録住所なし",
      totalUnits: parseInt(size || "0", 10),
      currentTerm: parseInt(term || "1", 10),
    };

    setCondos([...condos, newCondo]);
    setSelectedCondoId(newCondo.id);
  };

  // Preset loading for easy evaluation
  const loadExampleMinutes = () => {
    setMinutesText(`第23期定時総会議事録
日時：2024年5月18日
場所：高輪グランドハイツ集会室
出席者：区分所有者120名のうち、出席・書面表決合わせて102名

第1号議案：第23期収支決算報告承認の件（全会一致で可決承認）
第2号議案：修繕積立金段階的引上げの計画承認の件
理事長から、将来の大規模修繕工事（第27期を予定）に備え、修繕積立金が大幅に不足する見込みであることが報告された。この対応策として、第25期（再来年）より修繕積立金一律3%増額を実施し、毎年の徴収額を補強する段階増額スキームが提案された。
組合員より、現在の物価高の状況下で負担増を懸念する意見があったが、大規模修繕の実現に不可欠であるとの理事会説明に対し、出席者の4分の3以上の賛成を得て可決・承認された。
【重要約束】：本件決定に基づき、第25期の定時総会予算案においては、修繕積立金を3%増額した内容で予算計画を策定・可決することを義務付ける（後年に繰り延べ不可）。

第3号議案：役員選任の件（可決承認）
役員の任期については管理規約に則り2年間とする。今回新たに高橋理事長、鈴木理事、佐藤監事らが選出された。彼らの任期は第23期定時総会終結から第25期定時総会終結時まで（2年間）の運営を担う。第24期は中間年であり役員改選は不要、第25期定時総会にて改選を行う。`);
    
    setMinutesFileName("第23期定時総会議事録.txt");
    setMinutesUploadTerm(23);
    setMinutesUploadDate("2024-05-18");
  };

  // File helpers in browser
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setMinutesFileName(file.name);

    // Auto-detect term from typical naming (e.g. 第23期... or 23...)
    const termMatch = file.name.match(/(?:第)?(\d+)(?:期)?/);
    if (termMatch && termMatch[1]) {
      setMinutesUploadTerm(parseInt(termMatch[1]));
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const base64Data = dataUrl.split(",")[1];
      setFileBase64(base64Data);
      setFileMimeType(file.type || "application/octet-stream");
    };
    reader.readAsDataURL(file);
  };

  const handleClearFile = () => {
    setUploadedFile(null);
    setFileBase64("");
    setFileMimeType("");
    setMinutesFileName("");
  };

  // Parse Minutes via AI
  const handleParseMinutes = async () => {
    if (uploadMode === "text" && !minutesText) {
      alert("解析する議事録のテキストがありません。入力してください。");
      return;
    }
    if (uploadMode === "file" && !fileBase64) {
      alert("アップロードされたファイルがありません。ファイルを選択するか、テキスト入力を選んでください。");
      return;
    }

    setIsParsing(true);
    try {
      const requestBody: any = {
        fileName: minutesFileName || (uploadMode === "file" ? uploadedFile?.name : `第${minutesUploadTerm}期定時総会議事録.txt`)
      };

      if (uploadMode === "file") {
        requestBody.fileBase64 = fileBase64;
        requestBody.mimeType = fileMimeType;
      } else {
        requestBody.text = minutesText;
      }

      const response = await fetch(import.meta.env.BASE_URL.replace(/\/$/,"") + "/api/parse-minutes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
      });
      const resData = await response.json();
      if (resData.success && resData.data) {
        const item = resData.data;
        const newMinutes: PastMinutes = {
          id: "pm_" + Date.now(),
          condoName: item.condoName || currentCondo.name,
          term: item.term || minutesUploadTerm,
          date: item.date || minutesUploadDate,
          summary: item.summary || "",
          resolutions: item.resolutions || [],
          keyContradictionPoints: item.keyContradictionPoints || []
        };
        setPastMinutes(prev => [newMinutes, ...prev]);
        setMinutesText("");
        handleClearFile();
        alert(`【AI解析成功】第${newMinutes.term}期の議事録を読み込み、正常に過去データベースへ登録しました。`);
        setActiveTab("past");
      } else {
        throw new Error(resData.error || "解析結果が不正です。");
      }
    } catch (error: any) {
      console.error("Parse Minutes Error:", error);
      alert("過去議事録の解析に失敗しました: " + (error.message || error));
    } finally {
      setIsParsing(false);
    }
  };

  // Generate Agendas via AI
  const handleGenerateAgendas = async () => {
    if (!currentCondo) return;
    setIsGenerating(true);
    try {
      const condoPastMinutes = pastMinutes.filter(m => m.condoName === currentCondo.name);
      const defaultAgendasList = Object.entries(selectedDefaultTypes)
        .filter(([_, active]) => active)
        .map(([key, _]) => {
          if (key === "settlement") return "第1号議案：前期収支決算報告及び監査報告承認の件";
          if (key === "budget") return "第2号議案：今期事業計画案及び収支予算案承認の件";
          if (key === "contract") return "第3号議案：管理会社委託契約更新承認の件";
          if (key === "personnel") return "第4号議案：役員選任の件";
          if (key === "repair") return "第5号議案：大規模修繕工事及び工事計画・資金支出承認の件";
          return "第6号議案：管理細則一部改定の件";
        });

      const response = await fetch(import.meta.env.BASE_URL.replace(/\/$/,"") + "/api/generate-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condoName: currentCondo.name,
          term: targetTerm,
          targetDate: targetDate,
          pastMinutesList: condoPastMinutes,
          focusPoints: focusPoints,
          defaultAgendas: defaultAgendasList
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const item = resData.data;
        setCurrentDraft({
          term: item.term || targetTerm,
          targetDate: item.targetDate || targetDate,
          agendas: item.agendas || []
        });
        setIsAudited(false);
        setConsistencyIssues([]);
        alert("【AI自動作成完了】今期の議案書のドラフトを新規作成しました。「議案詳細プレビュー」で確認・編集してください。");
      } else {
        throw new Error(resData.error || "生成された議案データが不正です。");
      }
    } catch (error) {
      console.error("Generate Agendas Error:", error);
      alert("AIによる議案書生成に失敗しました（ローカルの基本テンプレートで初期化します）: " + (error.message || error));
      handleApplyTemplates();
    } finally {
      setIsGenerating(false);
    }
  };

  // Check Consistency via AI
  const handleCheckConsistency = async () => {
    if (!currentDraft) {
      alert("議案書が存在しません。");
      return;
    }
    setIsChecking(true);
    try {
      const condoPastMinutes = pastMinutes.filter(m => m.condoName === currentCondo.name);
      const response = await fetch(import.meta.env.BASE_URL.replace(/\/$/,"") + "/api/check-consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          condoName: currentCondo.name,
          term: targetTerm,
          agendas: currentDraft.agendas,
          pastMinutesList: condoPastMinutes
        })
      });

      const resData = await response.json();
      if (resData.success && resData.data) {
        const item = resData.data;
        setConsistencyIssues(item.inconsistencies || []);
        setIsAudited(true);
        if (item.hasInconsistencies) {
          alert(`【整合性チェック実施】未整合エラー・確認事項が ${item.inconsistencies.length} 件検出されました。リストを確認して対応してください。`);
        } else {
          alert("【整合性チェック実施】完璧です！過去決議との大きな矛盾や義務の無視は検出されませんでした（適正判定）。");
        }
      } else {
        throw new Error(resData.error || "整合性チェック結果が不正です。");
      }
    } catch (error) {
      console.error("Check Consistency Error:", error);
      alert("AIによる整合性判定中にエラーが発生しました（ローカル組み込みの整合性チェッカーで実行します）: " + (error.message || error));
      const localIssues = runLocalConsistencyCheck(currentDraft.agendas);
      setConsistencyIssues(localIssues);
      setIsAudited(true);
    } finally {
      setIsChecking(false);
    }
  };

  // Simulate human error simulator
  const simulateHumanError = () => {
    if (!currentDraft) {
      alert("議案書を先に作成・選択してください。");
      return;
    }
    const finalAgendas = currentDraft.agendas.map(agenda => {
      if (agenda.type === "budget") {
        return {
          ...agenda,
          content: `【収支予算案の計画概要】
1．管理費会計総額：12,600,000円 (設備保全諸点検・清掃費用等の支出)
2．修繕積立金月額改定：本年度は近年の物価高及び組合員の家計負担への急激な影響を考慮し、前年通り（据え置き・改定なし）の料金にて徴収をおこないます。
※当初予定されていた3%の段階引き上げ計画（第23期決議事項）は、今期の予算案においては一時的に保留といたします。`
        };
      }
      return agenda;
    });

    if (!finalAgendas.some(a => a.type === "personnel")) {
      finalAgendas.push({
        id: "draft_personnel_injected",
        title: "第4号議案：役員選任の件",
        proposer: "理事会",
        reason: "第25期活動において、役員の全員退任を決定したため、急遽新しい役員の選任をお願いするものです。",
        content: "第25期定時総会終結をもって役員全員が辞任することとし、新たな理事会構成メンバー（理事5名、監事1名）を選出します。選出対象：山田太郎、佐藤次郎、木村花子...",
        type: "personnel"
      });
    }

    setCurrentDraft({ ...currentDraft, agendas: finalAgendas });
    setIsAudited(false);
    alert("【シミュレーション】予算案を『値上げ据え置き（矛盾コード）』に変更し、さらに改選期ではないのに『全員辞任に伴う役員改選議案（不要な議案）』を注入しました！\n「過去決議との整合性チェック」を実行してみて、AIが不整合を検知できるか確認してください。");
  };

  if (!isAccountReady) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex items-center justify-center p-4">
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 text-white p-8 flex flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-snug">議案書自動作成・整合性チェック</h1>
                <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                  各物件担当者が自分のアカウントでログインし、担当物件・議事録DB・議案ドラフトを個別に保存できます。
                  別担当者の保存内容とは分離されるため、他者の更新で自分の作業内容が上書きされません。
                </p>
              </div>
            </div>
            <div className="space-y-3 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span>担当者アカウントIDと保護キーごとに保存領域を分離</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span>複数物件を同じ担当者ワークスペース内で管理可能</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5" />
                <span>保存済みデータはサーバー側のアカウント専用JSONに保持</span>
              </div>
            </div>
          </div>

          <form onSubmit={handleLoginAccount} className="p-8 space-y-5">
            <div>
              <div className="text-xs font-bold text-indigo-600 mb-2">新栄総合管理・議案書作成支援AI</div>
              <h2 className="text-xl font-bold text-slate-900">担当者アカウントで開始</h2>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                例：front-tanaka、sato-a など。保護キーは同じアカウント領域を再読込するために必要です。
              </p>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                  <User className="w-3.5 h-3.5" /> 担当者名・表示名
                </span>
                <input
                  value={accountDisplayName}
                  onChange={(e) => setAccountDisplayName(e.target.value)}
                  placeholder="例：田中、佐藤A"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                  <Cloud className="w-3.5 h-3.5" /> 担当者アカウントID <span className="text-red-500">*</span>
                </span>
                <input
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="例：front-tanaka"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mb-1">
                  <KeyRound className="w-3.5 h-3.5" /> アカウント保護キー <span className="text-red-500">*</span>
                </span>
                <input
                  type="password"
                  value={accountPin}
                  onChange={(e) => setAccountPin(e.target.value)}
                  placeholder="4文字以上"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            {accountError && (
              <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-xs font-medium">
                {accountError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoadingAccount}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold text-sm py-3 rounded-xl transition shadow-md flex items-center justify-center gap-2"
            >
              {isLoadingAccount ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              {isLoadingAccount ? "読み込み中..." : "このアカウントで開始"}
            </button>

            <div className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-3 text-[11px] leading-relaxed">
              同じ担当者IDでも保護キーが異なる場合は別の保存領域になります。共有アカウント運用は避け、担当者ごとに固有IDを使ってください。
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col">
      {/* Bento Grid layout outer container */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6 flex-grow flex flex-col">
        {/* Header - Modern premium slate layout */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-600/10">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                議案書自動作成・整合性チェック
                <span className="text-indigo-600 font-semibold text-xs bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-lg">
                  管理組合総会支援システム
                </span>
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-wide">
                AIが前回の議事録から制約条件・役員任期・予算値上げ条件を読み込み、自動監査 ＆ DOCX出力
              </p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto md:items-center">
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl justify-between md:justify-start">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-4 h-4 text-indigo-600" />
                <div className="text-left min-w-0">
                  <div className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider leading-none">担当者アカウント</div>
                  <div className="text-xs font-bold text-slate-800 truncate max-w-[180px]">{accountDisplayName || accountId}</div>
                  <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{saveStatus}{lastSavedAt ? `・${new Date(lastSavedAt).toLocaleString()}` : ""}</div>
                </div>
              </div>
              <button
                onClick={handleSaveWorkspace}
                disabled={isSavingWorkspace}
                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition"
                title="この担当者アカウント専用領域に保存"
              >
                {isSavingWorkspace ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                保存
              </button>
              <button
                onClick={handleLogoutAccount}
                className="p-1.5 bg-white hover:bg-slate-100 border border-indigo-100 text-slate-500 transition rounded-lg"
                title="担当者を切り替える"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl justify-between md:justify-start">
              <div className="flex items-center gap-2.5 font-normal">
                <Building className="w-4 h-4 text-indigo-500" />
                <div className="text-left">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">選択中のマンション</div>
                  <select
                    value={selectedCondoId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      setSelectedCondoId(nextId);
                      const found = condos.find(c => c.id === nextId);
                      if (found) {
                        setTargetTerm(found.currentTerm);
                      }
                    }}
                    className="bg-transparent text-xs font-bold border-none text-slate-800 focus:outline-none cursor-pointer mt-0.5"
                  >
                    {condos.map((c) => (
                      <option key={c.id} value={c.id} className="text-slate-900">
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={handleOpenAddCondo}
                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition rounded-lg ml-2 shadow-sm"
                title="マンション追加"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {accountError && (
          <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl p-3 text-xs font-medium flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{accountError}</span>
          </div>
        )}

        {/* Main Tabs Navigation - Bento Grid Navigation block */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2 shadow-sm">
          <nav className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            <button
              onClick={() => setActiveTab("dash")}
              className={`py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "dash"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Layers className="w-4 h-4" />
              理事会ダッシュボード
            </button>
            <button
              onClick={() => setActiveTab("past")}
              className={`py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "past"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <History className="w-4 h-4" />
              過去総会議事録DB
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${
                activeTab === "past" ? "bg-indigo-700 text-indigo-100" : "bg-slate-100 text-slate-600"
              }`}>
                {pastMinutes.filter(m => m.condoName === currentCondo.name).length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("draft")}
              className={`py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "draft"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              今期議案自動作成・監査
              {currentDraft && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ml-1 ${
                  activeTab === "draft" ? "bg-indigo-700 text-indigo-100" : "bg-green-100 text-green-700"
                }`}>
                  ドラフトあり
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`py-3 px-4 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition ${
                activeTab === "about"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              機能・ひな形解説
            </button>
          </nav>
        </div>

        {/* Main Content Area */}
        <main className="flex-grow space-y-6">
          <AnimatePresence mode="wait">
            {/* ==========================================
                TAB 1: DASHBOARD
                ========================================== */}
            {activeTab === "dash" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
                key="dash"
              >
                {/* Promo Banner / Overview */}
                <div className="bg-gradient-to-br from-indigo-50 via-slate-50 to-indigo-50 border border-indigo-100 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold tracking-widest text-indigo-700 uppercase bg-indigo-100/60 px-2.5 py-1 rounded-full">
                      分譲マンションフロント特化型DX支援ツール
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-900">
                      現在の組合運営計画（{currentCondo.name}）
                    </h2>
                    <p className="text-sm text-slate-600 max-w-2xl font-normal">
                      過去の総会議事録を登録しておくと、AIが重要な前決議（修繕金価格アップの約束、役員の任期、契約改定事項）を自動抽出。新総会でこれらとの整合性を1タップで照合し不整合を防止します。
                    </p>
                  </div>
                  <div className="flex gap-2 font-normal">
                    <button
                      onClick={() => setActiveTab("past")}
                      className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold px-4 py-2.5 rounded-xl transition hover:bg-slate-50 flex items-center gap-1.5 shadow-sm"
                    >
                      <FileText className="w-4 h-4 text-indigo-500" />
                      過去の議事録の管理へ
                    </button>
                    <button
                      onClick={() => setActiveTab("draft")}
                      className="bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition hover:bg-indigo-700 flex items-center gap-1.5 shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20"
                    >
                      <Wand2 className="w-4 h-4 text-amber-300" />
                      今期の議案書作成へ
                    </button>
                  </div>
                </div>

                {/* Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-normal">
                  {/* Info Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4">
                    <div className="space-y-3 font-normal">
                      <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                        <Building className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">建物・組合基本情報</h3>
                        <p className="text-xs text-slate-500 mt-1 font-normal">
                          管理会社：新栄総合管理（株）
                        </p>
                      </div>
                      <div className="border-t border-slate-100 pt-3 space-y-2 text-sm text-slate-700 font-normal">
                        <div className="flex justify-between font-normal">
                          <span className="text-slate-400">管理組合名：</span>
                          <span className="font-semibold">{currentCondo.name}</span>
                        </div>
                        <div className="flex justify-between font-normal">
                          <span className="text-slate-400">建物規模：</span>
                          <span>約 {currentCondo.totalUnits} 戸</span>
                        </div>
                        <div className="flex justify-between font-normal">
                          <span className="text-slate-400">現在稼働期：</span>
                          <span className="font-semibold text-indigo-600 font-bold">第 {currentCondo.currentTerm} 期</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleOpenEditCondo}
                      className="w-full text-center text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold py-2 rounded-xl transition"
                    >
                      運営期・戸数の基本情報修正
                    </button>
                  </div>

                  {/* DB Status */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4 font-normal">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                        <History className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">登録済みの過去決議データ</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          読み込み済みの総会
                        </p>
                      </div>
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        {pastMinutes.filter(m => m.condoName === currentCondo.name).length === 0 ? (
                          <div className="text-center py-4 text-slate-400 text-xs font-normal">
                            過去の議事録は登録されていません
                          </div>
                        ) : (
                          pastMinutes.filter(m => m.condoName === currentCondo.name).slice(0, 3).map((m) => (
                            <div key={m.id} className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 font-normal">
                              <FileText className="w-3.5 h-3.5 text-slate-400" />
                              <div className="flex-grow font-semibold">第 {m.term} 期 総会議事録</div>
                              <div className="text-[10px] text-slate-400">{m.date}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab("past")}
                      className="w-full text-center text-xs text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold py-2 rounded-xl transition shadow-sm"
                    >
                      過去議事録DBの変更 ＆ 追加
                    </button>
                  </div>

                  {/* Audit Helper Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between space-y-4 font-normal">
                    <div className="space-y-3">
                      <div className="w-10 h-10 bg-green-50 rounded-xl flex items-center justify-center border border-green-100">
                        <ShieldCheck className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg">整合性チェックステータス</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          過去決議事項との確認状況
                        </p>
                      </div>
                      <div className="border-t border-slate-100 pt-3 flex-grow flex items-center justify-center">
                        {!currentDraft ? (
                          <div className="text-slate-400 text-xs flex items-center gap-2 py-2 font-normal">
                            <Info className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            今期の議案書（ドラフト）が未編成です。
                          </div>
                        ) : !isAudited ? (
                          <div className="text-amber-600 text-xs flex items-center gap-2 py-2 font-medium bg-amber-50 p-2 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 animate-pulse" />
                            過去決議との整合性チェックが未実施です。
                          </div>
                        ) : consistencyIssues.length === 0 ? (
                          <div className="text-green-700 text-xs flex items-center gap-2 py-2 font-medium bg-green-50 p-2 rounded-lg">
                            <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                            整合性チェック実施済：矛盾はありません。
                          </div>
                        ) : (
                          <div className="text-red-700 text-xs flex items-center gap-2 py-2 font-medium bg-red-50 p-2 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            {consistencyIssues.filter(i => i.severity === "high").length} 件の不整合を検出。
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {currentDraft ? (
                      <button
                        onClick={() => setActiveTab("draft")}
                        className="w-full text-center text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-semibold py-2 rounded-xl transition shadow-sm"
                      >
                        議案書の確認 編集・監査
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveTab("draft")}
                        className="w-full text-center text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold py-3 rounded-xl transition flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                        今期の議案自動ドラフト生成
                      </button>
                    )}
                  </div>
                </div>

                {/* Visual System flow */}
                <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-md">
                  <div className="absolute right-0 top-0 opacity-10 pointer-events-none transform translate-x-12 -translate-y-12">
                    <Wand2 className="w-96 h-96 text-white" />
                  </div>
                  <div className="relative space-y-4 max-w-xl">
                    <h4 className="font-mono text-amber-500 text-sm font-bold tracking-widest uppercase">
                      SYSTEM WORKFLOW
                    </h4>
                    <h3 className="font-bold text-xl md:text-2xl text-slate-100">
                      新栄総合管理・議案書作成支援AI の3ステップ総会準備
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 text-xs text-slate-300 font-normal">
                      <div className="space-y-2 border-l-2 border-amber-500/60 pl-3">
                        <div className="font-semibold text-slate-100">1. Past Resolutions Data</div>
                        <p className="leading-relaxed text-slate-400">
                          「第24期」「第23期」などの総会議事録をコピペ登録。AIが決議を解析して将来の監査条件DBを自動成文化。
                        </p>
                      </div>
                      <div className="space-y-2 border-l-2 border-indigo-500/60 pl-3">
                        <div className="font-semibold text-slate-100">2. Smart Agenda Draft</div>
                        <p className="leading-relaxed text-slate-400">
                          今期の重点議題を指示。過去決議（段階積立金、役員任期など）に基づいて矛盾しない最適な議案書をAIが高速作成。
                        </p>
                      </div>
                      <div className="space-y-2 border-l-2 border-emerald-500/60 pl-3">
                        <div className="font-semibold text-slate-100">3. Audit & Word Export</div>
                        <p className="leading-relaxed text-slate-400">
                          ワンタップで整合性を徹底監査。おかしな点を修正し、最後は実務で使える極めてフォーマルな総会用のWordひな形を取得。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ==========================================
                TAB 2: PAST MINUTES DATABASE
                ========================================== */}
            {activeTab === "past" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
                key="past"
              >
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                      <History className="text-indigo-600" />
                      過去定時総会議事録データベース
                    </h2>
                    <p className="text-sm text-slate-500 font-normal">
                      過去の意思決定（決議事項・宿題・任期・工事約束等）を登録することで、今期の提案不整合を自動監査します。
                    </p>
                  </div>
                  <button
                    onClick={loadExampleMinutes}
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Sparkles className="w-4 h-4 text-white" />
                    サンプル議事録(矛盾付き)を読み込む
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Upload & Add Minutes Form */}
                  <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4 font-normal">
                    <h3 className="font-bold text-slate-900 border-b border-slate-100 pb-2 text-md">
                      過去議事録の取り込み・追加
                    </h3>

                    {/* Mode Toggle Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                      <button
                        onClick={() => setUploadMode("file")}
                        className={`flex-1 py-1.5 rounded-lg transition text-center ${
                          uploadMode === "file" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        📄 ファイルから取り込み
                      </button>
                      <button
                        onClick={() => setUploadMode("text")}
                        className={`flex-1 py-1.5 rounded-lg transition text-center ${
                          uploadMode === "text" ? "bg-white text-indigo-700 shadow-xs" : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        ✍️ テキスト直接コピペ
                      </button>
                    </div>
                    
                    <div className="space-y-3 text-xs">
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">対象期（半角数字で設定）</label>
                        <input
                          type="number"
                          value={minutesUploadTerm}
                          onChange={(e) => setMinutesUploadTerm(parseInt(e.target.value) || 23)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-600 font-medium mb-1">元総会の開催年月日</label>
                        <input
                          type="date"
                          value={minutesUploadDate}
                          onChange={(e) => setMinutesUploadDate(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {uploadMode === "file" ? (
                        <div className="space-y-3">
                          <label className="block text-slate-600 font-medium text-[11px]">議事録を選択 (対応: pdf, doc, docx, txt)</label>
                          
                          {!uploadedFile ? (
                            <div className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-xl p-5 text-center cursor-pointer transition bg-slate-50/50 hover:bg-indigo-50/5 relative">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,.txt"
                                onChange={handleFileChange}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              />
                              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                              <div className="text-slate-700 font-medium text-[11px]">ファイルを選択・ドラッグ＆ドロップ</div>
                              <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                                PDF・Word・TXT形式に対応しています。<br />
                                <span className="text-indigo-600 font-semibold">※画像スキャン等のPDFでも、AIによる高度なOCR機能で正確に解析されます。</span>
                              </p>
                            </div>
                          ) : (
                            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="w-7 h-7 text-indigo-500 shrink-0" />
                                <div className="min-w-0 text-left leading-snug">
                                  <div className="text-slate-800 font-semibold truncate text-[11px]">{uploadedFile.name}</div>
                                  <div className="text-slate-400 text-[9px]">
                                    {(uploadedFile.size / 1024).toFixed(1)} KB • {uploadedFile.name.endsWith(".pdf") ? "PDF (AI OCR適用)" : "一般形式"}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={handleClearFile}
                                className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition shrink-0"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {uploadedFile && (
                            <div>
                              <label className="block text-slate-600 font-medium mb-1">議事録ファイルの名称確認</label>
                              <input
                                type="text"
                                value={minutesFileName}
                                onChange={(e) => setMinutesFileName(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500 text-xs"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-slate-600 font-medium mb-1">議事録ファイルの名称 (任意)</label>
                            <input
                              type="text"
                              placeholder="例：第23期定時総会議事録.txt"
                              value={minutesFileName}
                              onChange={(e) => setMinutesFileName(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 focus:outline-none focus:border-indigo-500 text-xs"
                            />
                          </div>
                          <div>
                            <label className="block text-slate-600 font-medium mb-1">議事録/議決報告テキスト (貼り付け)</label>
                            <textarea
                              rows={11}
                              placeholder="ここに紙の議事録をスキャンしたテキストや、ワードテキストをそのまま貼り付けてください。第X号議案の可決状況、議論内容など適当な文章で大丈夫です。AIが自動パースします。"
                              value={minutesText}
                              onChange={(e) => setMinutesText(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500 text-xs font-mono"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleParseMinutes}
                      disabled={isParsing || (uploadMode === "file" ? !fileBase64 : !minutesText)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isParsing || (uploadMode === "file" ? !fileBase64 : !minutesText)
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed" 
                          : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                      }`}
                    >
                      {isParsing ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          AIが解析中 (OCR/テキスト抽出実行中)...
                        </>
                      ) : (
                        <>
                          <UploadCloud className="w-4 h-4" />
                          過去議事録の解析を実行 ＆ 登録
                        </>
                      )}
                    </button>
                  </div>

                  {/* Display Past Minutes Database List */}
                  <div className="lg:col-span-2 space-y-4 font-normal">
                    <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-slate-900 text-md">
                        現在登録されている過去の総会議事録（全件）
                      </h3>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg font-semibold">
                        登録件数: {pastMinutes.filter(m => m.condoName === currentCondo.name).length}件
                      </span>
                    </div>

                    {pastMinutes.filter(m => m.condoName === currentCondo.name).length === 0 ? (
                      <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2 font-normal">
                        <FileText className="w-12 h-12 mx-auto stroke-[1.2] text-slate-300" />
                        <div>過去の議事録データが登録されていません。</div>
                        <p className="text-xs max-w-sm mx-auto text-slate-400">
                          左側のフォームからファイルをアップロードするか、右上の「サンプル議事録」をクリックしてお試しデータを流し込んでください。登録件数に上限はありません。
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {pastMinutes
                          .filter(m => m.condoName === currentCondo.name)
                          .sort((a, b) => b.term - a.term)
                          .map((minutes) => (
                            <div key={minutes.id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4 relative overflow-hidden font-normal animate-fadeIn">
                              <div className="absolute right-0 top-0 flex items-center">
                                <button
                                  onClick={() => {
                                    if (confirm(`第${minutes.term}期の過去議事録データを削除しますか？`)) {
                                      setPastMinutes(prev => prev.filter(m => m.id !== minutes.id));
                                    }
                                  }}
                                  className="text-slate-400 hover:text-red-500 transition mr-2 p-1 rounded hover:bg-slate-100"
                                  title="この議事録データを取り消し"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <div className="bg-indigo-50 text-indigo-700 font-mono text-xs font-bold px-3 py-1.5 rounded-bl-xl border-l border-b border-indigo-100">
                                  第 {minutes.term} 期
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 bg-green-500 rounded-full"></span>
                                <h4 className="font-bold text-slate-900 text-sm">
                                  定時総会議事録 （開催日: {minutes.date || "未記録"}）
                                </h4>
                              </div>

                              {/* Brief summary */}
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed font-normal">
                                <strong>AIによる総会要約:</strong> {minutes.summary}
                              </div>

                              {/* Key contradiction points */}
                              {minutes.keyContradictionPoints && minutes.keyContradictionPoints.length > 0 && (
                                <div className="space-y-1.5">
                                  <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">AI監査用抽出ポイント（整合性監査の重要条件）:</div>
                                  <ul className="list-disc pl-4 text-xs text-slate-700 space-y-1">
                                    {minutes.keyContradictionPoints.map((p, idx) => (
                                      <li key={idx}>{p}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Resolutions list */}
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">主な可決決議案：</div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {minutes.resolutions?.map((res, idx) => (
                                    <div key={idx} className="bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 line-clamp-1">{res.agendaTitle}</span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                          res.isApproved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                        }`}>
                                          {res.isApproved ? "可決" : "否決"}
                                        </span>
                                      </div>
                                      <p className="text-slate-500 font-normal leading-normal text-[11px] line-clamp-2">{res.contentSummary}</p>
                                      {res.detail && (
                                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-100 font-normal mt-1 leading-normal">
                                          付記: {res.detail}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}\n\n                    {/* ==========================================
              TAB 3: DRAFT CREATION & AUDITING & EXPORT
              ========================================== */}
          {activeTab === "draft" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Wand2 className="text-indigo-600" />
                    今期第 {targetTerm} 期 新規議案書の自動ドラフト ＆ 整合性チェック
                  </h2>
                  <p className="text-sm text-slate-500">
                    現在のマンション運営期に対応する総会議案書を自動組成し、過去に決めた内容と矛盾が無いかエージェントが徹底監査します。
                  </p>
                </div>
                {/* Active Condo Badge */}
                <div className="text-xs bg-slate-200/80 px-3 py-1.5 rounded-xl font-semibold border border-slate-300">
                  対象: {currentCondo.name}
                </div>
              </div>

              {/* Step Flow Banner */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                
                {/* Left Side: Draft configuration and Trigger button */}
                <div className="lg:col-span-1 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-950 border-b border-slate-150 pb-2 text-sm flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    1. 議案書作成条件の設定
                  </h3>

                  <div className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">今期の総会（第何期か）</label>
                      <input
                        type="number"
                        value={targetTerm}
                        onChange={(e) => setTargetTerm(parseInt(e.target.value) || 25)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">総会開催予定日</label>
                      <input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 font-medium mb-1">今期の重点指示（AIへの指示）</label>
                      <textarea
                        rows={6}
                        placeholder="今期の重点テーマ、修繕工事の有無、役員の交代の事情など特記すべき課題を入力してください。"
                        value={focusPoints}
                        onChange={(e) => setFocusPoints(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-indigo-500 leading-normal"
                      />
                    </div>

                    {/* Checkboxes of default agendas to generate */}
                    <div className="space-y-2">
                      <label className="block text-slate-600 font-medium mb-1">上程する定型議案の選択</label>
                      <div className="space-y-1.5">
                        <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
                          <input
                            type="checkbox"
                            checked={selectedDefaultTypes.settlement}
                            onChange={(e) => setSelectedDefaultTypes({ ...selectedDefaultTypes, settlement: e.target.checked })}
                            className="text-indigo-600 focus:indigo-500 rounded"
                          />
                          <span>事業決算報告 (第1号議案)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
                          <input
                            type="checkbox"
                            checked={selectedDefaultTypes.budget}
                            onChange={(e) => setSelectedDefaultTypes({ ...selectedDefaultTypes, budget: e.target.checked })}
                            className="text-indigo-600 focus:indigo-500 rounded"
                          />
                          <span>今期予算及び事業 (第2号議案)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg">
                          <input
                            type="checkbox"
                            checked={selectedDefaultTypes.contract}
                            onChange={(e) => setSelectedDefaultTypes({ ...selectedDefaultTypes, contract: e.target.checked })}
                            className="text-indigo-600 focus:indigo-500 rounded"
                          />
                          <span>管理委託契約の更新 (第3号議案)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded-lg text-amber-700">
                          <input
                            type="checkbox"
                            checked={selectedDefaultTypes.personnel}
                            onChange={(e) => setSelectedDefaultTypes({ ...selectedDefaultTypes, personnel: e.target.checked })}
                            className="text-indigo-600 focus:indigo-500 rounded"
                          />
                          <span>役員選任の件 (不整合検証用)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateAgendas}
                    disabled={isGenerating}
                    className={`w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 ${
                      isGenerating
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-400" />
                        AI議案エージェント執筆中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 text-amber-300" />
                        AI 議案書ドラフト自動作成
                      </>
                    )}
                  </button>
                </div>

                {/* Right Side: Generated Agendas Details ＆ Auditing Actions */}
                <div className="lg:col-span-3 space-y-6">
                  {/* Status checklist or empty draft state */}
                  {!currentDraft ? (
                    <div className="bg-white p-16 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-center space-y-3">
                      <Sparkles className="w-16 h-16 mx-auto stroke-[1.2] text-amber-500/70 animate-pulse" />
                      <div>今期の定時総会 議案ドラフトがまだありません。</div>
                      <p className="text-xs max-w-md mx-auto leading-relaxed">
                        左側の「対象期」「上程する定型議案」を確認し、<strong>「AI 議案書ドラフト自動作成」</strong>ボタンを押してください。過去の決議宿題を踏まえ、プロレベルの議案テキストが一瞬で自動生成されます。
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Control center: Audit & Word Export triggers */}
                      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">
                              第 {currentDraft.term} 期 議案書編集・整合性検証
                            </h3>
                            <p className="text-[11px] text-slate-400">
                              このパネルでAIが書いたドラフト内容を確認し、2タップで最終品質まで引き上げます。
                            </p>
                          </div>
                          
                          {/* Cheat button to alter texts for validation */}
                          <div className="flex gap-2.5">
                            <button
                              onClick={simulateHumanError}
                              className="text-amber-600 hover:text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1"
                              title="手動で矛盾・ミスを混入させて、AIのチェック性能をテストします"
                            >
                              <AlertTriangle className="w-3.5 h-3.5" />
                              バグ・矛盾混入テスト
                            </button>
                          </div>
                        </div>

                        {/* Action buttons columns */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Consistency Checking */}
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex flex-col justify-between whitespace-normal">
                            <div className="text-xs mb-2 text-slate-600 font-semibold flex items-center gap-1.5">
                              <span className="bg-indigo-600 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">2</span>
                              過去の決定決定との整合性チェック
                            </div>
                            <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                              今回の予算案や役員改定が、過去の総会議事で取り決めたルールと矛盾・乖離していないか自動照合。
                            </p>
                            <button
                              onClick={handleCheckConsistency}
                              disabled={isChecking}
                              className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                                isChecking
                                  ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                                  : "bg-indigo-900 hover:bg-indigo-800 text-white shadow-sm"
                              }`}
                            >
                              {isChecking ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  過去決議の隅々までスキャン中...
                                </>
                              ) : (
                                <>
                                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                  過去決議との整合性チェック実行
                                </>
                              )}
                            </button>
                          </div>

                          {/* Word Export options */}
                          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between whitespace-normal">
                            <div className="text-xs mb-2 text-slate-600 font-semibold flex items-center gap-1.5">
                              <span className="bg-indigo-600 text-white w-5 h-5 rounded-full inline-flex items-center justify-center text-[10px] font-bold">3</span>
                              総会提出用 Word ひな形での出力
                            </div>
                            <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">
                              日本のマンション実務でそのまま配布できる「表紙・招集通知・議案対照表」に整えた形式でWord出力。
                            </p>
                            
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleDownloadDocx(false)}
                                className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-bold py-2 px-2 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-sm"
                              >
                                <FileDown className="w-4 h-4 text-indigo-500" />
                                通常議案書
                              </button>
                              <button
                                onClick={() => handleDownloadDocx(true)}
                                disabled={!isAudited}
                                className={`flex-1 font-bold py-2 px-2 rounded-lg text-xs transition flex items-center justify-center gap-1 shadow-sm ${
                                  !isAudited
                                    ? "bg-slate-100 text-slate-350 border border-slate-150 cursor-not-allowed"
                                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                                }`}
                                title={!isAudited ? "まず整合性チェックを行ってください" : "監査コメントを末尾のページに付録として含めWord保存"}
                              >
                                {isAudited ? (
                                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                                ) : (
                                  <FileText className="w-4 h-4" />
                                )}
                                監査付き議案書
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Auditing Alert Output Panel (Saves lives of real-estate front desk workers!) */}
                        {isAudited && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 mt-4 text-white"
                          >
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                              <h4 className="font-bold text-xs flex items-center gap-2 text-indigo-400">
                                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                                AI Consistency Guard ―― 過去決議整合性検証レポート
                              </h4>
                              <span className="text-[10px] bg-slate-800 text-slate-400 px-2.5 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold">
                                Realtime Audit Active
                              </span>
                            </div>

                            {consistencyIssues.length === 0 ? (
                              <div className="bg-emerald-500/10 text-emerald-200 text-xs p-4 rounded-xl border border-emerald-500/20 flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <strong className="font-bold text-white block text-sm">不整合エラーは検出されませんでした（適正）</strong>
                                  <p className="text-slate-300 leading-relaxed font-light">
                                    本第 {currentDraft.term} 期総会の上程予定議案について、事前に登録されている過去の総会議事録の決議内容（修繕費段階改定の取り決め、現役員の就任期、次回検討誓約事項など）との重篤な矛盾は確認されません。このまま議案の製版作業・配布文書作成へ移行可能です。
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {consistencyIssues.map((issue) => {
                                  const severityStyles =
                                    issue.severity === "high"
                                      ? { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-200", icon: "text-red-400", badge: "bg-red-500/20 text-red-300" }
                                      : issue.severity === "medium"
                                      ? { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-200", icon: "text-amber-400", badge: "bg-amber-500/20 text-amber-300" }
                                      : { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-200", icon: "text-indigo-400", badge: "bg-indigo-500/20 text-indigo-300" };

                                  return (
                                    <div
                                      key={issue.id}
                                      className={`${severityStyles.bg} border ${severityStyles.border} p-4 rounded-xl text-xs flex items-start gap-3.5`}
                                    >
                                      {issue.severity === "high" ? (
                                        <AlertTriangle className={`w-5 h-5 ${severityStyles.icon} flex-shrink-0 mt-0.5`} />
                                      ) : (
                                        <Info className={`w-5 h-5 ${severityStyles.icon} flex-shrink-0 mt-0.5`} />
                                      )}
                                      <div className="space-y-2 w-full text-slate-200">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <span className="font-bold text-white block text-sm">{issue.title}</span>
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${severityStyles.badge}`}>
                                            {issue.severity === "high" ? "重大な不適合" : issue.severity === "medium" ? "要確認" : "監査アドバイス"}
                                          </span>
                                        </div>
                                        <p className="text-slate-300 leading-normal font-light">{issue.description}</p>
                                        
                                        <div className="bg-slate-950/40 p-3 rounded-lg text-xs mt-1.5 leading-relaxed font-mono border border-slate-800">
                                          <span className="text-slate-400 font-bold block mb-1 text-[10px] uppercase tracking-wider">Reference Log (論拠とする過去決議の参照):</span>
                                          <span className="text-slate-300 font-light">{issue.pastResolutionReference}</span>
                                        </div>
                                        
                                        <div className="bg-indigo-500/5 p-3 rounded-lg text-xs leading-relaxed font-mono border border-indigo-550/20">
                                          <span className="text-indigo-300 font-bold block mb-1 text-[10px] uppercase tracking-wider">Action Plan (推奨修正アクション):</span>
                                          <span className="text-indigo-200">{issue.recommendation}</span>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </div>

                      {/* Agendas Editor view */}
                      <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 text-md px-1 select-none">
                          議案詳細プレビュー（直接修正してWordへ即時反映可能）
                        </h3>

                        {currentDraft.agendas.map((agenda, i) => (
                          <div key={agenda.id || i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-wrap gap-2">
                              {/* Title editing */}
                              <div className="flex-grow">
                                <input
                                  type="text"
                                  value={agenda.title}
                                  onChange={(e) => handleUpdateAgendaText(agenda.id, "title", e.target.value)}
                                  className="font-bold text-slate-900 text-base bg-slate-50 p-1.5 rounded border border-transparent hover:border-slate-300 focus:bg-white focus:border-indigo-500 w-full focus:outline-none"
                                />
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg border border-slate-200">
                                  ID: {agenda.id}
                                </span>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold uppercase ${
                                  agenda.type === "settlement" ? "bg-blue-100 text-blue-700" :
                                  agenda.type === "budget" ? "bg-green-100 text-green-700" :
                                  agenda.type === "contract" ? "bg-purple-100 text-purple-700" :
                                  agenda.type === "personnel" ? "bg-amber-100 text-amber-700" :
                                  agenda.type === "repair" ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-700"
                                }`}>
                                  {agenda.type === "settlement" ? "決算報告" :
                                   agenda.type === "budget" ? "予算審議" :
                                   agenda.type === "contract" ? "委託契約" :
                                   agenda.type === "personnel" ? "役員選任" :
                                   agenda.type === "repair" ? "修繕工事" : "一般案件"}
                                </span>
                              </div>
                            </div>

                            {/* Reason for upper visual block */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">上程理由・趣旨：</label>
                              <textarea
                                rows={3}
                                value={agenda.reason}
                                onChange={(e) => handleUpdateAgendaText(agenda.id, "reason", e.target.value)}
                                className="w-full text-xs bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-indigo-500 leading-normal text-slate-700"
                              />
                            </div>

                            {/* Main Resolving Content */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">具体的な決議及び提案内容：</label>
                              <textarea
                                rows={8}
                                value={agenda.content}
                                onChange={(e) => handleUpdateAgendaText(agenda.id, "content", e.target.value)}
                                className="w-full text-xs font-mono bg-slate-50/70 p-3 rounded-xl border border-slate-100 hover:border-slate-300 focus:bg-white focus:outline-none focus:border-indigo-500 leading-relaxed text-slate-850"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ==========================================
              TAB 4: MANUAL & KNOWLEDGE BASE
              ========================================== */}
          {activeTab === "about" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 space-y-6"
            >
              <div>
                <h2 className="text-xl font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <BookOpen className="text-indigo-600" />
                  システムの重要機能と出力するワード「ひな形」の仕様解説
                </h2>
                <p className="text-sm text-slate-600 mt-2">
                  本システムは、マンション管理会社の業務効率化および、総会の公的な手続きにおける中長期不整合リスクを低減する監査エンジンとして企画・設計されています。
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-950 text-base border-l-4 border-indigo-600 pl-2 leading-none">
                    1. なぜ「過去の決議事項との整合判定」が必要なのか？
                  </h3>
                  <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
                    <p>
                      分譲マンション管理組合の総会決議（議決）は、現行および次世代の区分所有者全員に法的な拘束力を持ちます。しかし、実務では以下のような致命的ミスが後を絶ちません。
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 font-medium text-slate-700">
                      <li>
                        修繕積立金を「第25期（今年）から3%増やす」と2年前の総会で可決決定しているのに、今年の通常予算の作成時に元担当員から新担当員への引き継ぎ漏れ等で、値上げのない予算案を上程・可決してしまい不整合の瑕疵が生じた。
                      </li>
                      <li>
                        役員任期は「2年」と定めているのに、その中間年である今年に特に辞任者もいない状態で、誤って役員全員の選任議案を上程してしまい、議事運営の法的な整合性を欠く事態になった。
                      </li>
                      <li>
                        前回の総会で「管理委託報酬の据え置き契約は1年限り」として条件可決されたが、今回の委託更新で以前の決定と食い違った内容が混入した。
                      </li>
                    </ul>
                    <p>
                      当エージェントは過去の議事録テキストから【約束・制約・期や数値】を自動抽出・認識。作成した今期議案ドラフトと機械的に相互照合することでお客様の「法的瑕疵」と「担当者の確認漏れ」を水際で防御します。
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-slate-950 text-base border-l-4 border-indigo-600 pl-2 leading-none">
                    2. ダウンロードされるワード（.docx）ひな形の特徴
                  </h3>
                  <div className="text-xs text-slate-600 space-y-2.5 leading-relaxed">
                    <p>
                      出力は単なるテキストエクスポートではありません。日本の信託銀行、大手不動産管理デベロッパーの管理組合窓口、マンション管理士事務所等の実務にそのまま耐えられる**「日本型標準議案書ひな形」**を精密に出力します。
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 font-medium text-slate-700">
                      <li>
                        <strong>総会招集通知（通知状＆式次第）を完備：</strong>
                        鏡文（拝啓、区分所有者各位）、理事長捺印署名用アンダーバー、議事進行スケジュール、各議案タイトルの全リストを2ページ目に自動出力します。
                      </li>
                      <li>
                        <strong>実務に則したレイアウト：</strong>
                        文字サイズ（26pt、18pt等の和文書基準）、飾り罫、見出しルール（MSゴシックとMS明朝の組み合わせ）をプログラミング。インデントも正しく計算されています。
                      </li>
                      <li>
                        <strong>提案理由と決議枠をマトリクス化：</strong>
                        Word上で最も編集しやすい「表（Table構造）」を各議案に自動構成。理由と議案内容を別欄で比較でき、印刷時やPDF変換時にも崩れません。
                      </li>
                      <li>
                        <strong>監査レポートを付録可能：</strong>
                        「監査付き議案書」を選んだ場合のみ、文書の最終ページに安全点検を行った不整合検証・AIアドバイス結果が自動印字され、事前の社内確認や理事長への解説メモとして利用できます。
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Dev Note */}
              <div className="border-t border-slate-100 pt-6">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 flex items-start gap-3">
                  <Info className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900">開発者・管理者向け環境変数ノート</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      本アプリは、クライアントからの意図に従って完璧に Gemini サーバープロキシ経由で動作するフルスタック設計。
                      API keys、秘密のセキュリティはサーバーサイドで100%遮断され非表示にて保護されています。
                      Word生成ロジックはブラウザ内にて <code>docx</code> パックにより即時パッキング。サーバー負荷、転送ロスなく最高のセキュリティを実現しています。
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      </div> {/* Close max-w-7xl Bento wrapper */}

      {/* Footer - Professional Slate color */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 px-8 text-xs text-center mt-auto rounded-t-2xl">
        <div className="max-w-7xl mx-auto space-y-1">
          <div>分譲マンション管理組合 総会・理事会 議案書作成システム</div>
          <div>Copyright 2026. All operations verified with secure server-side Gemini API.</div>
        </div>
      </footer>

      {/* Add Condo Dialog Modal */}
      {isAddCondoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-indigo-600 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <h3 className="font-bold text-xs">新規マンション・組合の追加</h3>
              </div>
              <button 
                onClick={() => setIsAddCondoOpen(false)}
                className="text-white/80 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <form onSubmit={handleCreateCondoSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  マンション名 ・ 管理組合名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={addCondoName}
                  onChange={(e) => setAddCondoName(e.target.value)}
                  placeholder="例：高輪第2グランドハイツ管理組合"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    総戸数 (戸)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addCondoUnits}
                    onChange={(e) => setAddCondoUnits(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    現在の運営期 (数字)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={addCondoTerm}
                    onChange={(e) => setAddCondoTerm(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition font-medium"
                  />
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddCondoOpen(false)}
                  className="px-3.5 py-1.5 hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  登録する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Condo Dialog Modal */}
      {isEditCondoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="bg-indigo-600 px-5 py-3.5 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <h3 className="font-bold text-xs">基本情報の修正</h3>
              </div>
              <button 
                onClick={() => setIsEditCondoOpen(false)}
                className="text-white/80 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateCondoSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  マンション名 ・ 管理組合名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editCondoName}
                  onChange={(e) => setEditCondoName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    総戸数 (戸)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editCondoUnits}
                    onChange={(e) => setEditCondoUnits(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1">
                    現在の運営期 (期)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editCondoTerm}
                    onChange={(e) => setEditCondoTerm(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs text-slate-800 focus:outline-none focus:border-indigo-500 transition font-medium"
                  />
                </div>
              </div>

              <div className="pt-3.5 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditCondoOpen(false)}
                  className="px-3.5 py-1.5 hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-bold rounded-xl transition"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
