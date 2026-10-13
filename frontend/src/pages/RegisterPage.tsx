import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useRegister } from "../api/auth";
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { inputClass } from "../components/styles";

// Mirrors the backend UserCreate schema: password 8..120 characters.
const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(120, "Password must be at most 120 characters"),
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const registerUser = useRegister();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await registerUser.mutateAsync(values);
      navigate("/", { replace: true });
    } catch {
      // Shown below via registerUser.error
    }
  });

  return (
    <AuthCard title="Create account">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="new-password" className={inputClass} {...register("password")} />
        </Field>
        {registerUser.isError && (
          <p role="alert" className="text-sm text-danger">
            {registerUser.error.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
