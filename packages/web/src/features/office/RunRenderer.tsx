import type { ComposedRunDto } from '../../api/types';

export interface RunRendererProps {
  readonly run: ComposedRunDto;
  readonly reviewerMode: boolean;
}

export function RunRenderer({ run, reviewerMode }: RunRendererProps): JSX.Element | null {
  switch (run.type) {
    case 'text':
      return <span>{run.value}</span>;
    case 'rubric':
      return <span className="run-rubric">{run.value}</span>;
    case 'citation':
      return <span className="run-citation">{run.value}</span>;
    case 'unresolved-macro':
      return reviewerMode
        ? <span className="run-unresolved" title="Unresolved macro">{`&${run.name}`}</span>
        : null;
    case 'unresolved-formula':
      return reviewerMode
        ? <span className="run-unresolved" title="Unresolved formula">{`$${run.name}`}</span>
        : null;
    case 'unresolved-reference':
      return reviewerMode
        ? <span className="run-unresolved" title="Unresolved reference">{'@?'}</span>
        : null;
    default: {
      const _exhaustive: never = run;
      void _exhaustive;
      return <span />;
    }
  }
}
