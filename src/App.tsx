import "./App.css";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { InputField } from "./components/InputField";
import { Button } from "./components/Button";

type FormData = {
  address: string;
  message: string;
  signature: string;
};

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<boolean>();
  const [error, setError] = useState<string | undefined>();

  const [urlParams, setUrlParams] = useSearchParams();

  useEffect(() => {
    setUrlParams(new URLSearchParams());
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    trigger,
    setFocus,
    watch,
  } = useForm<FormData>({
    mode: "onChange",
    defaultValues: {
      address: urlParams.get("address") || "",
      message: urlParams.get("message") || "",
      signature: urlParams.get("signature") || "",
    },
  });

  watch(() => {
    setError(undefined);
    setVerificationResult(undefined);
  });

  async function onSubmit(data: FormData) {
    setError(undefined);
    setVerificationResult(undefined);

    const { address, message, signature } = data;
    const url = `https://dev.api.dfx.swiss/v1/auth/verifySignature?address=${encodeURIComponent(
      address
    )}&message=${encodeURIComponent(message)}&signature=${encodeURIComponent(
      signature
    )}`;
    try {
      const response = await fetch(url);
      const responseJson = await response.json();
      setVerificationResult(responseJson.isValid);
    } catch (error: any) {
      setError(error.toString());
    }
  }

  const handleValidationAndFocus = async () => {
    setIsLoading(true);
    const isValid = await trigger();
    if (!isValid) {
      if (errors.address) {
        setFocus("address");
      } else if (errors.message) {
        setFocus("message");
      } else if (errors.signature) {
        setFocus("signature");
      }
    }

    await handleSubmit(onSubmit)();
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col justify-start gap-8 p-2 pt-6 max-w-screen-sm">
      <div>
        <div className="text-4xl font-extrabold text-slate-900 dark:text-slate-200 tracking-tight">
          Verify a signed crypto message
        </div>
        <p className="mt-4 text-lg text-slate-700 dark:text-slate-400 leading-snug">
          Enter the address, message, and signature to verify the signature.
        </p>
      </div>
      <form>
        <div className="flex flex-col gap-4">
          <InputField
            id="address"
            label="Address"
            register={register}
            errors={errors}
          />
          <InputField
            id="message"
            label="Message"
            register={register}
            errors={errors}
            isTextArea
          />
          <InputField
            id="signature"
            label="Signature"
            register={register}
            errors={errors}
          />

          {error && (
            <div className="bg-red-200 text-red-500 p-2 rounded-md">
              {error}
            </div>
          )}

          <Button
            label={isLoading ? "VERIFYING..." : "VERIFY"}
            onClick={handleValidationAndFocus}
            disabled={isLoading}
            isLoading={isLoading}
            isGrayedOut={!isValid}
          />

          {verificationResult !== undefined && (
            <div
              className={`mt-2 p-2 rounded-md font-medium ${
                verificationResult
                  ? "bg-green-200 text-green-800"
                  : "bg-red-200 text-red-500"
              }`}
            >
              {verificationResult
                ? "Signature is valid"
                : "Signature is invalid"}
            </div>
          )}

          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            This website is operated and maintained as a non-profit project. The
            model was{" "}
            <a
              href="https://www.verifybitcoinmessage.com"
              target="_blank"
              rel="noreferrer"
              className="underline text-blue-500 hover:text-blue-600"
            >
              https://www.verifybitcoinmessage.com
            </a>
            . However, this website can check not only Bitcoin signatures but
            also Ethereum, Monero and other blockchain signatures. If you have
            any questions or suggestions, please contact{" "}
            <a
              href="mailto: verifycryptomessage@gmail.com"
              className="underline text-blue-500 hover:text-blue-600"
            >
              verifycryptomessage@gmail.com
            </a>
            .
          </div>

          <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Example Usage:{" "}
            <a
              href="https://verifycryptomessage.com/?address=1JWYmwtrqu2ttRDgtriFqivofWixCqRPRa&message=Hello%2C%20World!&signature=IHLrykoT8n7gF8M%2FC9pKVtRkxX446wx01kTcSqNmMBOOKFublbr5fj1moM0BwNrqoAdp7RMLr%2FBE%2BBM84jGNjOM%3D"
              className="underline text-blue-500 hover:text-blue-600 break-all"
            >
              https://verifycryptomessage.com/?address=1JWY...RPRa&message=Hello%2C%20World!&signature=IHLr...M%3D
            </a>
          </div>
        </div>
      </form>
    </div>
  );
}

export default App;
