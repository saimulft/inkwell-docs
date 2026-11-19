'use client';

import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  FileUp,
  Highlighter,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { IMPORT_ACCEPT, IMPORT_HELP_TEXT } from '@/lib/validation';

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
const keys = (shortcut: string) => shortcut.replace('Mod', isMac() ? '⌘' : 'Ctrl').replace(/\+/g, isMac() ? '' : '+');

type ButtonProps = {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

function ToolbarButton({ label, shortcut, active, disabled, onClick, children }: ButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClick}
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-md text-[var(--ink)] transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4',
            active && 'bg-[var(--brand-tint)] text-[var(--brand)] hover:bg-[var(--brand-tint)]',
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-1.5 opacity-70">{keys(shortcut)}</span>}
      </TooltipContent>
    </Tooltip>
  );
}

const Divider = () => <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />;

type Props = { editor: Editor; onInsertFile: (file: File) => void; inserting: boolean };

export function EditorToolbar({ editor, onInsertFile, inserting }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
      heading: ([1, 2, 3] as const).find((level) => e.isActive('heading', { level })) ?? 0,
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      taskList: e.isActive('taskList'),
      blockquote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      alignCenter: e.isActive({ textAlign: 'center' }),
      alignRight: e.isActive({ textAlign: 'right' }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex items-center gap-0.5 overflow-x-auto px-2 py-1.5 sm:px-3"
    >
      <ToolbarButton label="Undo" shortcut="Mod+Z" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label="Redo" shortcut="Mod+Shift+Z" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 />
      </ToolbarButton>
      <Divider />

      <Select
        value={String(state.heading)}
        onValueChange={(value) => {
          const level = Number(value);
          if (level === 0) chain().setParagraph().run();
          else
            chain()
              .setHeading({ level: level as 1 | 2 | 3 })
              .run();
        }}
      >
        <SelectTrigger
          size="sm"
          aria-label="Text style"
          className="w-[132px] shrink-0 border-transparent bg-transparent shadow-none hover:bg-muted"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent onCloseAutoFocus={(event) => event.preventDefault()}>
          <SelectItem value="0">Normal text</SelectItem>
          <SelectItem value="1">
            <span className="text-base font-bold">Heading 1</span>
          </SelectItem>
          <SelectItem value="2">
            <span className="text-[15px] font-semibold">Heading 2</span>
          </SelectItem>
          <SelectItem value="3">
            <span className="font-semibold">Heading 3</span>
          </SelectItem>
        </SelectContent>
      </Select>
      <Divider />

      <ToolbarButton label="Bold" shortcut="Mod+B" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolbarButton>
      <ToolbarButton label="Italic" shortcut="Mod+I" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        shortcut="Mod+U"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      >
        <Underline />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        shortcut="Mod+Shift+S"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton
        label="Highlight"
        shortcut="Mod+Shift+H"
        active={state.highlight}
        onClick={() => chain().toggleHighlight().run()}
      >
        <Highlighter />
      </ToolbarButton>
      <LinkButton editor={editor} active={state.link} />
      <Divider />

      <ToolbarButton
        label="Align left"
        active={!state.alignCenter && !state.alignRight}
        onClick={() => chain().setTextAlign('left').run()}
      >
        <AlignLeft />
      </ToolbarButton>
      <ToolbarButton
        label="Align center"
        active={state.alignCenter}
        onClick={() => chain().setTextAlign('center').run()}
      >
        <AlignCenter />
      </ToolbarButton>
      <ToolbarButton label="Align right" active={state.alignRight} onClick={() => chain().setTextAlign('right').run()}>
        <AlignRight />
      </ToolbarButton>
      <Divider />

      <ToolbarButton
        label="Bulleted list"
        shortcut="Mod+Shift+8"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        shortcut="Mod+Shift+7"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Checklist"
        shortcut="Mod+Shift+9"
        active={state.taskList}
        onClick={() => chain().toggleTaskList().run()}
      >
        <ListChecks />
      </ToolbarButton>
      <Divider />

      <ToolbarButton
        label="Quote"
        shortcut="Mod+Shift+B"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <Quote />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        shortcut="Mod+Alt+C"
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      >
        <Code2 />
      </ToolbarButton>
      <ToolbarButton label="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
        <RemoveFormatting />
      </ToolbarButton>
      <Divider />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1.5 px-2.5 text-[13px]"
            disabled={inserting}
            onClick={() => fileInput.current?.click()}
          >
            {inserting ? <Loader2 className="animate-spin" /> : <FileUp />}
            Insert file
          </Button>
        </TooltipTrigger>
        <TooltipContent>Insert a file at the cursor: {IMPORT_HELP_TEXT}</TooltipContent>
      </Tooltip>
      <input
        ref={fileInput}
        type="file"
        accept={IMPORT_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onInsertFile(file);
        }}
      />
    </div>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');

  function apply(event: FormEvent) {
    event.preventDefault();
    const value = url.trim();
    const chain = editor.chain().focus().extendMarkRange('link');
    if (!value) {
      chain.unsetLink().run();
    } else {
      const href = /^(https?:|mailto:)/i.test(value) ? value : `https://${value}`;
      if (editor.state.selection.empty && !active) {
        editor
          .chain()
          .focus()
          .insertContent({ type: 'text', text: value, marks: [{ type: 'link', attrs: { href } }] })
          .run();
      } else {
        chain.setLink({ href }).run();
      }
    }
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setUrl((editor.getAttributes('link').href as string | undefined) ?? '');
        setOpen(next);
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Link"
              aria-pressed={active}
              className={cn(
                'inline-flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-200 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-4',
                active && 'bg-[var(--brand-tint)] text-[var(--brand)]',
              )}
            >
              <Link2 />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Link</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-80">
        <form onSubmit={apply} className="space-y-2">
          <label htmlFor="link-url" className="text-sm font-medium">
            Link address
          </label>
          <Input
            id="link-url"
            value={url}
            autoFocus
            placeholder="example.com"
            onChange={(event) => setUrl(event.target.value)}
            className="h-9"
          />
          <div className="flex justify-end gap-2 pt-1">
            {active && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  editor.chain().focus().extendMarkRange('link').unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove link
              </Button>
            )}
            <Button type="submit" size="sm">
              Apply
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
