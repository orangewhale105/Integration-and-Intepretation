// レジュメ（このアプリで入力する部分のみ）を Word ファイルにする。A4 縦・2段組。
// 書式は学科のレジュメの見本（HGｺﾞｼｯｸM 10.5pt、見出し HGPｺﾞｼｯｸE、狭い余白の2段組）に合わせる。
// ファイルはブラウザの中で作り、どこにも送信しない。
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { findDiagnosis } from '../model/caseData';
import { problemList } from '../model/icidh';
import type { Card, CaseData, IcidhStage } from '../model/types';

const BODY_FONT = 'HGｺﾞｼｯｸM';
const HEAD_FONT = 'HGPｺﾞｼｯｸE';
/** 10.5pt（half-point 単位） */
const BODY_SIZE = 21;
const TABLE_SIZE = 18;

const font = (name: string) => ({ ascii: name, eastAsia: name, hAnsi: name });

function heading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 60 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } },
    children: [new TextRun({ text, font: font(HEAD_FONT), size: 22 })],
  });
}

function subHeading(text: string): Paragraph {
  return new Paragraph({ spacing: { before: 120 }, keepNext: true, children: [new TextRun({ text, font: font(HEAD_FONT) })] });
}

function line(text: string, opts: { indent?: boolean; bold?: boolean; keepNext?: boolean } = {}): Paragraph {
  return new Paragraph({
    indent: opts.indent ? { left: 210 } : undefined,
    keepNext: opts.keepNext,
    children: [new TextRun({ text, bold: opts.bold })],
  });
}

const filledRows = (card: Card) => card.rows.filter((r) => r.result.trim() !== '' || r.reference.trim() !== '');

/** 検査結果の表（基準値を書いた行があるときだけ2列にする） */
function resultTable(card: Card): Table {
  const rows = filledRows(card);
  const showRef = rows.some((r) => r.reference.trim() !== '');
  const cell = (text: string, header = false) =>
    new TableCell({
      margins: { left: 60, right: 60 },
      children: [new Paragraph({ alignment: header ? AlignmentType.CENTER : AlignmentType.LEFT, children: [new TextRun({ text, size: TABLE_SIZE })] })],
    });
  const header = new TableRow({ tableHeader: true, children: [cell('結果', true), ...(showRef ? [cell('基準値', true)] : [])] });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: showRef ? [3000, 1800] : [4800],
    rows: [header, ...rows.map((r) => new TableRow({ cantSplit: true, children: [cell(r.result), ...(showRef ? [cell(r.reference)] : [])] }))],
  });
}

/** 判定基準・出典・問題点のラベル */
function judgement(card: Card): Paragraph[] {
  const out: Paragraph[] = [];
  if (card.criterion.trim()) out.push(line(`判定基準：${card.criterion.trim()}`, { indent: true }));
  if (card.source.trim()) out.push(line(`出典：${card.source.trim()}`, { indent: true }));
  if (card.label.trim()) out.push(line(`→ ${card.label.trim()}`, { indent: true, bold: true }));
  return out;
}

/** 一般情報・医学的情報・他部門情報のカード：「名称：結果」の形 */
function infoCard(card: Card): Array<Paragraph | Table> {
  const rows = filledRows(card);
  const name = card.name.trim() || '（名称なし）';
  if (rows.some((r) => r.reference.trim() !== '')) {
    return [line(`${name}：`, { keepNext: true }), resultTable(card), ...judgement(card)];
  }
  const results = rows.map((r) => r.result.trim());
  const first = line(`${name}：${results[0] ?? ''}`);
  const rest = results.slice(1).map((r) => line(r, { indent: true }));
  return [first, ...rest, ...judgement(card)];
}

/** 検査結果のカード：「1. 検査名」の見出しと結果 */
function examCard(card: Card, n: number): Array<Paragraph | Table> {
  const rows = filledRows(card);
  const title = subHeading(`${n}. ${card.name.trim() || '（検査名なし）'}`);
  const body: Array<Paragraph | Table> = rows.some((r) => r.reference.trim() !== '') || rows.length > 1
    ? [resultTable(card)]
    : rows.map((r) => line(r.result.trim(), { indent: true }));
  return [title, ...body, ...judgement(card)];
}

const LEVELS: Array<{ stage: IcidhStage; label: string }> = [
  { stage: 'handicap', label: 'Handicap level' },
  { stage: 'disability', label: 'Disability level' },
  { stage: 'impairment', label: 'Impairment level' },
];

export function buildResumeDocument(data: CaseData): Document {
  const children: Array<Paragraph | Table> = [];
  const cardsOf = (cat: Card['category']) => data.cards.filter((c) => c.category === cat);

  children.push(heading('Ⅱ．一般情報'));
  cardsOf('general').forEach((c) => children.push(...infoCard(c)));

  children.push(heading('Ⅲ．医学的情報'));
  const diagnoses = data.diagnoses.map((d) => d.name.trim()).filter((s) => s !== '');
  if (diagnoses.length) children.push(line(`診断名：${diagnoses.join('、')}`));
  cardsOf('medical').forEach((c) => children.push(...infoCard(c)));

  children.push(heading('Ⅳ．他部門情報'));
  cardsOf('otherDept').forEach((c) => children.push(...infoCard(c)));

  children.push(heading('Ⅴ．理学療法初期評価'));
  cardsOf('exam').forEach((c, i) => children.push(...examCard(c, i + 1)));

  children.push(heading('Ⅵ．問題点抽出'));
  const items = problemList(data);
  for (const level of LEVELS) {
    const list = items.filter((it) => it.stage === level.stage);
    if (list.length === 0) continue;
    children.push(subHeading(level.label));
    for (const it of list) children.push(line(it.heading.replace(/^#(\d+) /, '＃$1　')));
  }
  const placedDiseases = data.icidh.diseases.map((id) => findDiagnosis(data, id)).filter((d) => !!d);
  if (placedDiseases.length) {
    children.push(subHeading('疾患'));
    placedDiseases.forEach((d, i) => children.push(line(`D${i + 1}　${d.name.trim()}`)));
  }

  return new Document({
    creator: '',
    title: data.caseName,
    styles: {
      default: {
        document: { run: { font: font(BODY_FONT), size: BODY_SIZE }, paragraph: { spacing: { line: 276 } } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
            // 見本と同じ余白（twip）
            margin: { top: 284, right: 284, bottom: 447, left: 454, header: 0, footer: 391 },
          },
          column: { count: 2, space: 414, equalWidth: true },
        },
        children,
      },
    ],
  });
}

export function buildResumeBlob(data: CaseData): Promise<Blob> {
  return Packer.toBlob(buildResumeDocument(data));
}
