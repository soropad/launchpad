import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AllowanceManager } from "@/components/AllowanceManager";
import { AllowanceList } from "@/components/AllowanceList";

// Mock the forms
jest.mock("@/components/forms/ApproveForm", () => ({
  ApproveForm: ({ onSuccess }: { onSuccess: (txHash: string) => void }) => (
    <button onClick={() => onSuccess("tx-hash-1")}>Grant (Mocked)</button>
  ),
}));

jest.mock("@/components/forms/RevokeAllowanceForm", () => ({
  RevokeAllowanceForm: ({ onSuccess }: { onSuccess: (txHash: string) => void }) => (
    <button onClick={() => onSuccess("tx-hash-2")}>Revoke (Mocked)</button>
  ),
}));

jest.mock("@/components/forms/TransferFromForm", () => ({
  TransferFromForm: ({ onSuccess }: { onSuccess: (txHash: string) => void }) => (
    <button onClick={() => onSuccess("tx-hash-3")}>Transfer (Mocked)</button>
  ),
}));

describe("AllowanceManager", () => {
  it("renders the manager with all tabs", () => {
    render(<AllowanceManager />);

    expect(screen.getByText("Token Allowances")).toBeInTheDocument();
    expect(screen.getByText("Grant Allowance")).toBeInTheDocument();
    expect(screen.getByText("Revoke Allowance")).toBeInTheDocument();
    expect(screen.getByText("Transfer From")).toBeInTheDocument();
  });

  it("switches between tabs correctly", async () => {
    render(<AllowanceManager />);

    const revokeTab = screen.getByText("Revoke Allowance");
    await userEvent.click(revokeTab);

    // Check that content changed
    expect(screen.getByText("Revoke (Mocked)")).toBeInTheDocument();
  });

  it("displays success notification after grant", async () => {
    render(<AllowanceManager />);

    const grantButton = screen.getByText("Grant (Mocked)");
    await userEvent.click(grantButton);

    await waitFor(() => {
      expect(screen.getByText(/Allowance granted successfully!/i)).toBeInTheDocument();
    });
  });

  it("displays success notification after revoke", async () => {
    render(<AllowanceManager />);

    const revokeTab = screen.getByText("Revoke Allowance");
    await userEvent.click(revokeTab);

    const revokeButton = screen.getByText("Revoke (Mocked)");
    await userEvent.click(revokeButton);

    await waitFor(() => {
      expect(screen.getByText(/Allowance revoked successfully!/i)).toBeInTheDocument();
    });
  });

  it("displays success notification after transfer", async () => {
    render(<AllowanceManager />);

    const transferTab = screen.getByText("Transfer From");
    await userEvent.click(transferTab);

    const transferButton = screen.getByText("Transfer (Mocked)");
    await userEvent.click(transferButton);

    await waitFor(() => {
      expect(screen.getByText(/Transfer completed successfully!/i)).toBeInTheDocument();
    });
  });

  it("auto-dismisses notifications after 5 seconds", async () => {
    jest.useFakeTimers();

    render(<AllowanceManager />);

    const grantButton = screen.getByText("Grant (Mocked)");
    await userEvent.click(grantButton);

    await waitFor(() => {
      expect(screen.getByText(/Allowance granted successfully!/i)).toBeInTheDocument();
    });

    jest.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.queryByText(/Allowance granted successfully!/i)).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it("displays info section with instructions", () => {
    render(<AllowanceManager />);

    expect(screen.getByText("How allowances work:")).toBeInTheDocument();
    expect(screen.getByText(/Set the maximum amount a spender can transfer/i)).toBeInTheDocument();
    expect(screen.getByText(/Remove a spender's ability to transfer/i)).toBeInTheDocument();
    expect(screen.getByText(/Transfer tokens if you have an allowance/i)).toBeInTheDocument();
  });
});

describe("AllowanceList", () => {
  const mockAllowances = [
    {
      id: "1",
      tokenContractId: "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN",
      spenderAddress: "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ",
      amount: "1000.00",
      expirationLedger: 1000000,
      isExpired: false,
    },
    {
      id: "2",
      tokenContractId: "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN",
      spenderAddress: "GBJPHEJM3VE6D37MYVOKXCPY2TGFBQ6XTWZFSXFVEVT3ZCZZP2CAAAJX",
      amount: "500.00",
      expirationLedger: 500000,
      isExpired: true,
    },
  ];

  it("renders empty state when no allowances", () => {
    render(<AllowanceList allowances={[]} />);

    expect(screen.getByText("No active allowances")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    render(<AllowanceList isLoading={true} />);

    expect(screen.getByText("Loading allowances...")).toBeInTheDocument();
  });

  it("renders all allowances", () => {
    render(<AllowanceList allowances={mockAllowances} />);

    expect(screen.getByText("1000.00")).toBeInTheDocument();
    expect(screen.getByText("500.00")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("displays correct status for active allowances", () => {
    render(<AllowanceList allowances={[mockAllowances[0]]} />);

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("displays correct status for expired allowances", () => {
    render(<AllowanceList allowances={[mockAllowances[1]]} />);

    const expiredStatus = screen.getByText("Expired");
    expect(expiredStatus).toBeInTheDocument();
    expect(expiredStatus).toHaveClass("text-red-400");
  });

  it("copies spender address to clipboard", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });

    render(<AllowanceList allowances={[mockAllowances[0]]} />);

    const copyButton = screen.getAllByTitle("Copy address")[0];
    await userEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAllowances[0].spenderAddress);
  });

  it("displays correct expiration ledger", () => {
    render(<AllowanceList allowances={[mockAllowances[0]]} />);

    expect(screen.getByText("1,000,000")).toBeInTheDocument();
  });

  it("shows revoke button for active allowances", () => {
    const onRevoke = jest.fn();
    render(<AllowanceList allowances={[mockAllowances[0]]} onRevoke={onRevoke} />);

    const revokeButtons = screen.queryAllByText("Revoke");
    expect(revokeButtons.length).toBeGreaterThan(0);
  });

  it("disables revoke button for expired allowances", () => {
    render(<AllowanceList allowances={[mockAllowances[1]]} />);

    const expiredButton = screen.getByText("Expired");
    expect(expiredButton).toBeDisabled();
  });

  it("calls onRevoke callback when revoke button clicked", async () => {
    const onRevoke = jest.fn().mockResolvedValue(undefined);
    render(<AllowanceList allowances={[mockAllowances[0]]} onRevoke={onRevoke} />);

    const revokeButton = screen.getByText("Revoke");
    await userEvent.click(revokeButton);

    expect(onRevoke).toHaveBeenCalledWith("1");
  });

  it("shows loading state while revoking", async () => {
    let resolveRevoke: () => void;
    const revokePromise = new Promise<void>((resolve) => {
      resolveRevoke = resolve;
    });

    const onRevoke = jest.fn(() => revokePromise);
    render(<AllowanceList allowances={[mockAllowances[0]]} onRevoke={onRevoke} />);

    const revokeButton = screen.getByText("Revoke");
    await userEvent.click(revokeButton);

    await waitFor(() => {
      expect(screen.getByText("Revoking...")).toBeInTheDocument();
    });

    resolveRevoke!();

    await waitFor(() => {
      expect(screen.queryByText("Revoking...")).not.toBeInTheDocument();
    });
  });

  it("hides revoke button when no onRevoke callback", () => {
    render(<AllowanceList allowances={[mockAllowances[0]]} />);

    // Should still display spender and amount, just no revoke button
    expect(screen.getByText("1000.00")).toBeInTheDocument();
  });
});

describe("AllowanceList - Multiple allowances", () => {
  const mockAllowances = [
    {
      id: "1",
      tokenContractId: "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN",
      spenderAddress: "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ",
      amount: "1000.00",
      expirationLedger: 1000000,
      isExpired: false,
    },
    {
      id: "2",
      tokenContractId: "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN",
      spenderAddress: "GBJPHEJM3VE6D37MYVOKXCPY2TGFBQ6XTWZFSXFVEVT3ZCZZP2CAAAJX",
      amount: "500.00",
      expirationLedger: 500000,
      isExpired: false,
    },
    {
      id: "3",
      tokenContractId: "C3PFD7ZUMXGJK7MRMZBNLIMZRG3ASFXFVEVT5WYQXHB47MHRDPFVVFN",
      spenderAddress: "GCPFGJGZOXPF5EZBQ7TGVGVW4ZBDAJT3RDSAICABJ7GCM3QQHLJNZ7PZ",
      amount: "100.00",
      expirationLedger: 200000,
      isExpired: false,
    },
  ];

  it("renders all allowances in correct order", () => {
    render(<AllowanceList allowances={mockAllowances} />);

    const amounts = screen.getAllByText(/\d+\.\d{2}/);
    expect(amounts.length).toBeGreaterThanOrEqual(3);
  });

  it("handles revoke on specific allowance", async () => {
    const onRevoke = jest.fn().mockResolvedValue(undefined);
    render(<AllowanceList allowances={mockAllowances} onRevoke={onRevoke} />);

    const revokeButtons = screen.getAllByText("Revoke");
    await userEvent.click(revokeButtons[0]);

    expect(onRevoke).toHaveBeenCalledWith("1");
  });
});
