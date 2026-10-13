import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { useLogin } from "../api/auth";
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { inputClass } from "../components/styles";

// Mirrors the backend UserLogin schema: no password length rules on login.
const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync({ ...values, remember: false });
      navigate("/", { replace: true });
    } catch {
      // Shown below via login.error
    }
  });

  return (
    <AuthCard title="Log in">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" className={inputClass} {...register("password")} />
        </Field>
        {login.isError && (
          <p role="alert" className="text-sm text-danger">
            {login.error.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
