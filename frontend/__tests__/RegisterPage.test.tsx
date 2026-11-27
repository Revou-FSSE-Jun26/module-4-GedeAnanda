import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import RegisterPage from "@/app/register/page";
import { apiClient } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { toast } from "@/lib/toast";

const push = jest.fn();
const handleError = jest.fn();

jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
jest.mock("@/hooks/useErrorHandler", () => ({ useErrorHandler: () => ({ handleError }) }));
jest.mock("@/lib/apiClient", () => ({ apiClient: { post: jest.fn() } }));
jest.mock("@/lib/toast", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

const post = apiClient.post as jest.Mock;

async function fill(name: string, email: string, password: string) {
  if (name) await userEvent.type(screen.getByLabelText("Name"), name);
  if (email) await userEvent.type(screen.getByLabelText("Email"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("RegisterPage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows an error under each invalid field and sends nothing", async () => {
    render(<RegisterPage />);

    await fill("", "not-an-email", "short");

    expect(screen.getByLabelText("Name")).toHaveAccessibleDescription("Enter your name");
    expect(screen.getByLabelText("Email")).toHaveAccessibleDescription("Enter a valid email address");
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Use at least 8 characters");
    expect(screen.getAllByRole("alert")).toHaveLength(3);
    expect(post).not.toHaveBeenCalled();
  });

  it("flags only the field that is wrong", async () => {
    render(<RegisterPage />);

    await fill("Dana", "dana@example.com", "1234567");

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByLabelText("Password")).toBeInvalid();
    expect(screen.getByLabelText("Name")).toBeValid();
    expect(post).not.toHaveBeenCalled();
  });

  it("submits valid input and goes to /login", async () => {
    post.mockResolvedValue({ id: "1", name: "Dana", email: "dana@example.com" });
    render(<RegisterPage />);

    await fill("Dana", "dana@example.com", "12345678");

    expect(post).toHaveBeenCalledWith("/api/auth/register", {
      name: "Dana",
      email: "dana@example.com",
      password: "12345678",
    });
    expect(toast.success).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/login");
  });

  it("shows the API's message on the page and stays put", async () => {
    post.mockRejectedValue(new ApiError(409, "Email is already registered"));
    render(<RegisterPage />);

    await fill("Dana", "dana@example.com", "12345678");

    expect(await screen.findByRole("alert")).toHaveTextContent("Email is already registered");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });
});
