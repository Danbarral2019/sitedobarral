// Server Component - Renderiza markdown sem JavaScript no cliente
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
  content: string;
}

export default function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <div className="prose prose-lg prose-slate max-w-none
      prose-headings:font-bold prose-headings:text-gray-900 prose-headings:tracking-tight
      prose-h1:text-4xl prose-h1:mb-6 prose-h1:mt-8 prose-h1:border-b prose-h1:border-gray-200 prose-h1:pb-4
      prose-h2:text-3xl prose-h2:mb-5 prose-h2:mt-10 prose-h2:text-blue-900
      prose-h3:text-2xl prose-h3:mb-4 prose-h3:mt-8 prose-h3:text-blue-800
      prose-h4:text-xl prose-h4:mb-3 prose-h4:mt-6 prose-h4:text-gray-800
      prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4 prose-p:text-justify
      prose-a:text-blue-600 prose-a:font-medium prose-a:no-underline hover:prose-a:text-blue-800 hover:prose-a:underline
      prose-blockquote:border-l-4 prose-blockquote:border-blue-500 prose-blockquote:bg-blue-50 prose-blockquote:py-3 prose-blockquote:px-6 prose-blockquote:italic prose-blockquote:text-gray-700 prose-blockquote:rounded-r-lg prose-blockquote:my-6 prose-blockquote:shadow-sm
      prose-strong:text-gray-900 prose-strong:font-bold
      prose-em:text-gray-700 prose-em:italic
      prose-code:text-blue-700 prose-code:bg-blue-50 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
      prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:shadow-lg
      prose-ol:list-decimal prose-ol:pl-6 prose-ol:my-6 prose-ol:space-y-2
      prose-ul:list-disc prose-ul:pl-6 prose-ul:my-6 prose-ul:space-y-2
      prose-li:text-gray-700 prose-li:leading-relaxed
      prose-table:border-collapse prose-table:w-full prose-table:my-6
      prose-thead:bg-gray-100 prose-thead:border-b-2 prose-thead:border-gray-300
      prose-th:px-4 prose-th:py-3 prose-th:text-left prose-th:font-bold prose-th:text-gray-900
      prose-td:px-4 prose-td:py-3 prose-td:border-b prose-td:border-gray-200
      prose-hr:border-gray-300 prose-hr:my-8
      prose-img:rounded-lg prose-img:shadow-lg prose-img:mx-auto
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
