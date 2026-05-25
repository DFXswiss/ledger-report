import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
}

export function DateInput({ register, errors }: Props) {
  const hasError = Boolean(errors.date);
  return (
    <div className="w-full">
      <div
        className={`relative flex h-11 items-center rounded-xl border ${
          hasError ? "border-red-500" : "border-brand-200"
        } bg-white pl-3 pr-3 py-2.5`}
      >
        <input
          type="date"
          {...register("date", {
            required: "Date is required",
            validate: (value: string) => {
              const selectedDate = new Date(value);
              const today = new Date();
              return selectedDate <= today || "Date cannot be in the future";
            },
          })}
          max={new Date().toISOString().split("T")[0]}
          className="w-full bg-transparent text-base font-semibold text-brand focus:outline-none [&::-webkit-calendar-picker-indicator]:opacity-0"
        />
        <img
          src="/assets/icon-calendar.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-3 size-5"
        />
      </div>
      {hasError && (
        <p className="mt-1 px-2.5 text-xs font-medium text-red-500">
          {(errors.date?.message as string) || "Date is required"}
        </p>
      )}
    </div>
  );
}
