import type { UseFormRegister, FieldErrors } from "react-hook-form";

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: (name: any, value: string) => void;
}

export function WalletAddressInput({ register, errors, setValue }: Props) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setValue("address", text.trim());
    } catch {
      // Clipboard read can be blocked by the browser permission prompt — the
      // user can fall back to manual paste, no need to surface a hard error.
    }
  };

  const hasError = Boolean(errors.address);

  return (
    <section className="w-full rounded-3xl bg-brand p-5">
      <h2 className="px-2.5 text-lg font-semibold leading-6 tracking-tight text-white">
        Wallet Address
      </h2>
      <div
        className={`mt-1.5 flex h-11 items-center rounded-xl bg-white pl-3 pr-1.5 ${
          hasError ? "outline outline-2 outline-red-500" : ""
        }`}
      >
        <input
          type="text"
          autoComplete="off"
          placeholder="enter address"
          {...register("address", { required: "Wallet address is required" })}
          className="flex-1 bg-transparent text-base font-normal text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={handlePaste}
          className="ml-2 cursor-pointer rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90"
        >
          paste
        </button>
      </div>
      {hasError && (
        <p className="mt-2 px-2.5 text-xs font-medium text-white">
          {(errors.address?.message as string) || "Wallet address is required"}
        </p>
      )}
    </section>
  );
}
