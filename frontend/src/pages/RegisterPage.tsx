import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useRegister } from "../api/auth";

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
    <main className="mx-auto mt-16 max-w-sm p-4">
      <h1 className="mb-6 text-2xl font-semibold">Create account</h1>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" className="rounded border p-2" {...register("email")} />
          {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" className="rounded border p-2" {...register("password")} />
          {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
        </div>
        {registerUser.isError && (
          <p role="alert" className="text-sm text-red-600">
            {registerUser.error.message}
          </p>
        )}
        <button type="submit" disabled={isSubmitting} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          Create account
        </button>
      </form>
      <p className="mt-4 text-sm">
        Already have an account? <Link to="/login" className="underline">Log in</Link>
      </p>
    </main>
  );
}
