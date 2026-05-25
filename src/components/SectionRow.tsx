import type { ReactNode } from "react";
import { StepConnector } from "./StepConnector";

interface Props {
  title: string;
  children: ReactNode;
  variant?: "first" | "middle" | "last";
  headingId?: string;
}

export function SectionRow({ title, children, variant = "middle", headingId }: Props) {
  return (
    <div className="flex w-full items-stretch gap-2.5">
      <StepConnector variant={variant} />
      <div className="flex flex-1 flex-col gap-1 px-2 py-3 pr-5">
        <h2
          id={headingId}
          className="text-lg font-semibold leading-6 tracking-tight text-neutral-800"
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}
