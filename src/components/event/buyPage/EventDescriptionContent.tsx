import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

import { cn } from '@/lib/utils';

const descriptionSanitizeSchema = {
  ...defaultSchema,
  tagNames: ['p', 'br', 'strong', 'em', 'a', 'u'],
  attributes: {
    ...defaultSchema.attributes,
    a: ['href'],
  },
};

const descriptionClassName =
  'text-sm leading-relaxed text-black/90 md:text-base md:font-light [&_p+p]:mt-2 [&_strong]:font-bold [&_em]:italic [&_u]:underline';

interface EventDescriptionContentProps {
  description: string;
  className?: string;
}

function EventDescriptionContent({
  description,
  className,
}: EventDescriptionContentProps) {
  return (
    <div className={cn(descriptionClassName, className)}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, descriptionSanitizeSchema]]}
        components={{
          a: ({ href, children }) => {
            if (!href || !/^https?:\/\//i.test(href)) {
              return <span>{children}</span>;
            }

            return (
              <a
                href={href}
                target='_blank'
                rel='noopener noreferrer'
                className='break-all text-accent underline underline-offset-2'
              >
                {children}
              </a>
            );
          },
        }}
      >
        {description}
      </Markdown>
    </div>
  );
}

export default EventDescriptionContent;
