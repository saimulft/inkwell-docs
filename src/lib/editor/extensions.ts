import Highlight from '@tiptap/extension-highlight';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import TextAlign from '@tiptap/extension-text-align';
import StarterKit from '@tiptap/starter-kit';

/**
 * The document schema, shared by the browser editor and the server.
 * The server uses it to validate saved content and to convert imported files,
 * so anything a user can type is exactly what the API accepts.
 */
export const schemaExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
  }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Highlight,
  TaskList,
  TaskItem.configure({ nested: true }),
];
