import { autocompletion, closeBrackets } from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { HighlightStyle, bracketMatching, syntaxHighlighting } from '@codemirror/language';
import { SQLDialect, sql } from '@codemirror/lang-sql';
import { EditorState, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, placeholder as cmPlaceholder } from '@codemirror/view';
import { tags } from '@lezer/highlight';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { TABLES } from '../../data/schema';

// DuckDB/Snowflake-flavoured dialect: only keywords and functions you'd actually use here.
const Dealer = SQLDialect.define({
  keywords:
    'select from where group by having qualify order limit offset with recursive as on using join left right full outer inner cross semi anti ' +
    'natural and or not in is null like ilike between case when then else end distinct all union intersect except asc desc nulls first last ' +
    'over partition rows range preceding following unbounded current row exists interval cast true false window filter lateral values',
  builtin:
    'count sum avg min max round coalesce nullif ifnull iff greatest least abs floor ceil ceiling date_trunc date_diff datediff date_add dateadd ' +
    'date_part extract year month day quarter week dayofweek strftime current_date now as_of_date row_number rank dense_rank lag lead ' +
    'first_value last_value ntile percent_rank cume_dist count_if any_value arg_max arg_min median quantile_cont string_agg listagg ' +
    'lower upper trim length substr substring left right replace concat split_part regexp_matches regexp_replace position strpos ' +
    'try_cast generate_series unnest list_agg to_char',
  types: 'integer int bigint double decimal numeric varchar text date timestamp boolean',
  operatorChars: '*+-%<>!=&|~^/:',
  identifierQuotes: '"',
});

const schema: Record<string, string[]> = Object.fromEntries(TABLES.map((t) => [t.name, t.columns.map((c) => c.name)]));

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: '#ff9f5a', fontWeight: '700' },
  { tag: [tags.string, tags.special(tags.string)], color: '#8ef0a7' },
  { tag: [tags.number, tags.bool, tags.null], color: '#ffd23f' },
  { tag: tags.comment, color: '#9b8fb3', fontStyle: 'italic' },
  { tag: [tags.operator, tags.punctuation], color: '#f4ecff' },
  { tag: [tags.typeName, tags.standard(tags.name)], color: '#7cc8ff' },
  { tag: tags.function(tags.variableName), color: '#7cc8ff' },
  { tag: tags.name, color: '#f4ecff' },
]);

const theme = EditorView.theme(
  {
    '&': { backgroundColor: 'var(--code-bg)', color: 'var(--code-ink)', height: '100%', fontSize: '14px', borderRadius: '10px' },
    '.cm-scroller': { fontFamily: 'var(--font-code)', lineHeight: '1.55' },
    '.cm-content': { caretColor: '#ffd23f', padding: '10px 0' },
    '.cm-cursor': { borderLeftColor: '#ffd23f', borderLeftWidth: '2px' },
    '.cm-gutters': { backgroundColor: 'transparent', color: '#6e6388', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,0.04)' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(255,122,47,0.35) !important' },
    '.cm-tooltip-autocomplete': { background: '#2b1d3a', color: '#f4ecff', border: '2px solid #0b0710', borderRadius: '8px' },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { background: '#ff7a2f', color: '#fff' },
    '.cm-placeholder': { color: '#6e6388' },
  },
  { dark: true },
);

export interface SqlEditorHandle {
  getValue(): string;
  setValue(v: string): void;
  insert(text: string): void;
  focus(): void;
}

interface Props {
  value: string;
  onChange?: (v: string) => void;
  onRun?: () => void;
  readOnly?: boolean;
  placeholder?: string;
}

export const SqlEditor = forwardRef<SqlEditorHandle, Props>(function SqlEditor({ value, onChange, onRun, readOnly, placeholder }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onRunRef = useRef(onRun);
  onChangeRef.current = onChange;
  onRunRef.current = onRun;

  useEffect(() => {
    const runKey = Prec.highest(
      keymap.of([
        {
          key: 'Mod-Enter',
          run: () => {
            onRunRef.current?.();
            return true;
          },
        },
        {
          key: 'Shift-Enter',
          run: () => {
            onRunRef.current?.();
            return true;
          },
        },
      ]),
    );
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          runKey,
          lineNumbers(),
          history(),
          closeBrackets(),
          bracketMatching(),
          autocompletion({ activateOnTyping: true, icons: false }),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          sql({ dialect: Dealer, schema, upperCaseKeywords: true }),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorState.readOnly.of(!!readOnly),
          EditorView.editable.of(!readOnly),
          cmPlaceholder(placeholder ?? '-- write your SQL here'),
          EditorView.contentAttributes.of({ 'aria-label': 'SQL editor', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // external value changes (e.g. reset)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    getValue: () => view.current?.state.doc.toString() ?? '',
    setValue: (s) => {
      const v = view.current;
      if (v) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: s } });
    },
    insert: (text) => {
      const v = view.current;
      if (!v) return;
      const { from, to } = v.state.selection.main;
      const before = v.state.doc.sliceString(Math.max(0, from - 1), from);
      const needsSpace = before && !/[\s(,.]/.test(before) && /^\w/.test(text);
      const ins = (needsSpace ? ' ' : '') + text;
      v.dispatch({ changes: { from, to, insert: ins }, selection: { anchor: from + ins.length } });
      v.focus();
    },
    focus: () => view.current?.focus(),
  }));

  return <div ref={host} style={{ height: '100%', minHeight: 0, overflow: 'hidden', borderRadius: 10, border: '3px solid var(--line)' }} />;
});
