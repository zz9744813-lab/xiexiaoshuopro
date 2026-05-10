"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

interface TiptapEditorProps {
  content: string;
  onChange?: (content: string) => void;
  editable?: boolean;
  placeholder?: string;
  className?: string;
}

export function TiptapEditor({
  content,
  onChange,
  editable = true,
  placeholder = "开始写作...",
  className = "",
}: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getText());
    },
    editorProps: {
      attributes: {
        class: `prose prose-gray dark:prose-invert max-w-none focus:outline-none min-h-[60vh] ${className}`,
      },
    },
  });

  // 外部内容更新时同步到编辑器
  useEffect(() => {
    if (editor && content !== editor.getText()) {
      editor.commands.setContent(content ? `<p>${content.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>` : "");
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div className="tiptap-editor">
      {/* 工具栏 */}
      {editable && (
        <div className="flex gap-1 mb-3 pb-3 border-b border-gray-200 dark:border-gray-700 flex-wrap">
          <button
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-2 py-1 text-xs rounded ${
              editor.isActive("bold") ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            B
          </button>
          <button
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-2 py-1 text-xs rounded italic ${
              editor.isActive("italic") ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            I
          </button>
          <span className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-2 py-1 text-xs rounded ${
              editor.isActive("heading", { level: 2 }) ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            H2
          </button>
          <button
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`px-2 py-1 text-xs rounded ${
              editor.isActive("heading", { level: 3 }) ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            H3
          </button>
          <span className="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
          <button
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`px-2 py-1 text-xs rounded ${
              editor.isActive("blockquote") ? "bg-gray-200 dark:bg-gray-700" : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            引用
          </button>
          <button
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="px-2 py-1 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            分隔
          </button>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
