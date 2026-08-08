'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
interface JobDescriptionEditorProps {
  content?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function JobDescriptionEditor({ content = '', onChange, placeholder = 'Write the job description...', className = '' }: JobDescriptionEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content || '<p></p>',
    editorProps: {
      attributes: {
        class: 'min-h-[200px] px-4 py-3 focus:outline-none text-stone-900 text-sm [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:font-bold [&_h2]:mt-4 [&_h2]:mb-2',
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white overflow-hidden ${className}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}
