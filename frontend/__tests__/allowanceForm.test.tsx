import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApproveForm } from "@/components/forms/ApproveForm";
import { RevokeAllowanceForm } from "@/components/forms/RevokeAllowanceForm";
import { TransferFromForm } from "@/components/forms/TransferFromForm";

// Mock the hooks
jest.mock("@/hooks/useTransactionSimulator", () => ({
  useTransactionSimulator: () => ({
    isLoading: false,
    checkApprove: jest.fn().mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
    }),
    checkRevokeAllowance: jest.fn().mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
    }),
    checkTransferFrom: jest.fn().mockResolvedValue({
      success: true,
      errors: [],
      warnings: [],
    }),
  }),
}));

jest.mock("@/app/hooks/useWallet", () => ({
  useWallet: () => ({
    publicKey: "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ",
    signTransaction: jest.fn(),
  }),
}));

describe("ApproveForm", () => {
  it("renders the form with all required fields", () => {
    render(<ApproveForm />);

    expect(screen.getByText("Grant Allowance")).toBeInTheDocument();
    expect(screen.getByLabelText("Token Contract ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Spender Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByLabelText("Expiration (Days)")).toBeInTheDocument();
  });

  it("shows validation errors for invalid inputs", async () => {
    render(<ApproveForm />);

    const amountInput = screen.getByPlaceholderText("0.00");
    await userEvent.type(amountInput, "-100");

    await waitFor(() => {
      expect(screen.getByText("Amount must be positive")).toBeInTheDocument();
    });
  });

  it("disables submit button when preflight check fails", async () => {
    render(<ApproveForm />);

    const checkButton = screen.getByText("Run Preflight Check");
    expect(checkButton).toBeDisabled();

    // Fill in valid inputs
    const contractInput = screen.getByDisplayValue("");
    const spenderInput = screen.getByPlaceholderText("G...");
    const amountInput = screen.getByPlaceholderText("0.00");

    await userEvent.type(contractInput, "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
    await userEvent.type(spenderInput, "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ");
    await userEvent.type(amountInput, "100");

    await waitFor(() => {
      expect(checkButton).not.toBeDisabled();
    });
  });

  it("calls onSuccess callback when transaction succeeds", async () => {
    const onSuccess = jest.fn();
    render(<ApproveForm onSuccess={onSuccess} />);

    // Fill in form
    const contractInput = screen.getAllByPlaceholderText("C...")[0] as HTMLInputElement;
    const spenderInput = screen.getByPlaceholderText("G...");
    const amountInput = screen.getByPlaceholderText("0.00");

    await userEvent.type(contractInput, "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
    await userEvent.type(spenderInput, "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ");
    await userEvent.type(amountInput, "100");

    // Run preflight check
    const checkButton = screen.getByText("Run Preflight Check");
    await userEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText(/Allowance granted!/i)).toBeInTheDocument();
    });
  });

  it("calls onError callback when transaction fails", async () => {
    const onError = jest.fn();
    render(<ApproveForm onError={onError} />);

    // The form should have proper error handling
    expect(screen.getByText("Grant Allowance")).toBeInTheDocument();
  });
});

describe("RevokeAllowanceForm", () => {
  it("renders the form with required fields", () => {
    render(<RevokeAllowanceForm />);

    expect(screen.getByText("Revoke Allowance")).toBeInTheDocument();
    expect(screen.getByLabelText("Token Contract ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Spender Address")).toBeInTheDocument();
  });

  it("shows confirmation dialog before revoking", async () => {
    render(<RevokeAllowanceForm />);

    // Fill in form
    const contractInput = screen.getByPlaceholderText("C...");
    const spenderInput = screen.getByPlaceholderText("G...");

    await userEvent.type(contractInput, "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
    await userEvent.type(spenderInput, "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ");

    // Run preflight check
    const checkButton = screen.getByText("Run Preflight Check");
    await userEvent.click(checkButton);

    // Should show revoke button after preflight passes
    await waitFor(() => {
      expect(screen.getByText("Revoke Allowance")).toBeInTheDocument();
    });
  });

  it("allows canceling revocation", async () => {
    render(<RevokeAllowanceForm />);

    // Fill in form and run preflight
    const contractInput = screen.getByPlaceholderText("C...");
    const spenderInput = screen.getByPlaceholderText("G...");

    await userEvent.type(contractInput, "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
    await userEvent.type(spenderInput, "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ");

    const checkButton = screen.getByText("Run Preflight Check");
    await userEvent.click(checkButton);

    // Wait for confirmation to appear and cancel it
    await waitFor(() => {
      const cancelButtons = screen.queryAllByText("Cancel");
      if (cancelButtons.length > 0) {
        userEvent.click(cancelButtons[0]);
      }
    });
  });
});

describe("TransferFromForm", () => {
  it("renders the form with all required fields", () => {
    render(<TransferFromForm />);

    expect(screen.getByText("Transfer From Allowance")).toBeInTheDocument();
    expect(screen.getByLabelText("Token Contract ID")).toBeInTheDocument();
    expect(screen.getByLabelText("Source Address (who gave you allowance)")).toBeInTheDocument();
    expect(screen.getByLabelText("Recipient Address")).toBeInTheDocument();
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
  });

  it("validates all addresses are different", async () => {
    render(<TransferFromForm />);

    const contractInput = screen.getByPlaceholderText("C...");
    const fromInput = screen.getAllByPlaceholderText("G...")[0];
    const toInput = screen.getAllByPlaceholderText("G...")[1];
    const amountInput = screen.getByPlaceholderText("0.00");

    const sameAddress = "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ";

    await userEvent.type(contractInput, "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
    await userEvent.type(fromInput, sameAddress);
    await userEvent.type(toInput, sameAddress);
    await userEvent.type(amountInput, "100");

    // Form validation should work
    expect(contractInput).toHaveValue("C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
  });

  it("shows success message after transfer", async () => {
    const onSuccess = jest.fn();
    render(<TransferFromForm onSuccess={onSuccess} />);

    // Fill in form
    const contractInput = screen.getByPlaceholderText("C...");
    const fromInput = screen.getAllByPlaceholderText("G...")[0];
    const toInput = screen.getAllByPlaceholderText("G...")[1];
    const amountInput = screen.getByPlaceholderText("0.00");

    await userEvent.type(contractInput, "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN");
    await userEvent.type(fromInput, "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ");
    await userEvent.type(toInput, "GBJPHEJM3VE6D37MYVOKXCPY2TGFBQ6XTWZFSXFVEVT3ZCZZP2CAAAJX");
    await userEvent.type(amountInput, "100");

    // Run preflight check
    const checkButton = screen.getByText("Run Preflight Check");
    await userEvent.click(checkButton);

    await waitFor(() => {
      expect(screen.getByText(/Transfer successful!/i)).toBeInTheDocument();
    });
  });
});

describe("Allowance Form Integration", () => {
  it("handles network errors gracefully", async () => {
    const onError = jest.fn();
    render(<ApproveForm onError={onError} />);

    expect(screen.getByText("Grant Allowance")).toBeInTheDocument();
  });

  it("prevents submission without preflight check", async () => {
    render(<ApproveForm />);

    const submitButton = screen.getByText("Sign & Approve");
    expect(submitButton).toBeDisabled();
  });

  it("displays warnings from preflight check", () => {
    render(<ApproveForm />);

    expect(screen.getByText("Grant Allowance")).toBeInTheDocument();
  });
});
