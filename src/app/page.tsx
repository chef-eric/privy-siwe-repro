"use client";

/**
 * Reproduction for Privy SIWE flow:
 * 1. Connect wallet A
 * 2. Login with SIWE (wallet A)
 * 3. Logout & Disconnect
 * 4. Connect wallet B
 * 5. Login with SIWE (wallet B)
 */

import { useEffect, useRef, useState } from "react";
import {
  useConnectWallet,
  useLoginWithSiwe,
  usePrivy,
  useWallets,
} from "@privy-io/react-auth";
import { injected, useConnect } from "wagmi";

export default function Home() {
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Privy hooks
  const { authenticated, ready, user, logout } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { generateSiweMessage, loginWithSiwe } = useLoginWithSiwe();
  const { wallets } = useWallets();

  // Get external wallet (not embedded)
  const externalWallet = wallets.find((w) => w.walletClientType !== "privy");
  const address = externalWallet?.address;

  const log = (msg: string) => {
    const time = new Date().toISOString().split("T")[1].split(".")[0];
    setLogs((prev) => [...prev, `[${time}] ${msg}`]);
    console.log(`[${time}] ${msg}`);
  };

  const clearLogs = () => {
    setLogs([]);
    setError(null);
  };

  // Step 1 & 4: Connect wallet via Privy modal
  const handleConnect = async () => {
    try {
      setError(null);
      log(`--- Step ${currentStep}: Connecting Wallet ---`);
      log("Opening wallet connect modal...");
      connectWallet();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      log(`Connect failed: ${errorMessage}`);
      setError(errorMessage);
    }
  };

  // Step 2 & 5: Login with SIWE
  const handleLoginSiwe = async () => {
    if (!address || !externalWallet) {
      setError("No external wallet connected - connect wallet first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      log(`--- Step ${currentStep}: Starting SIWE Login ---`);
      log(`Address: ${address}`);
      log(`Wallet type: ${externalWallet.walletClientType}`);
      log(`Privy ready: ${ready}`);
      log(`Privy authenticated: ${authenticated}`);
      log(`Total wallets: ${wallets.length}`);

      log("Generating SIWE message...");
      const chainId = 1;
      const message = await generateSiweMessage({
        address,
        chainId: `eip155:${chainId}` as `eip155:${number}`,
      });
      log(`Message generated (chainId: eip155:${chainId})`);
      log(`Message: ${message}`);

      log(`Signed by: ${address}`);

      log("Requesting signature from wallet...");
      const provider = await externalWallet.getEthereumProvider();
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });
      log("Signature obtained");

      log("Calling loginWithSiwe()...");
      await loginWithSiwe({ message, signature: signature as string });
      log("✅ SUCCESS: loginWithSiwe completed!");

      // Advance to next step
      if (currentStep === 2) {
        setCurrentStep(3);
      } else if (currentStep === 5) {
        log("🎉 Full flow completed successfully!");
      }
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      log(`❌ FAILED: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Logout and Disconnect
  const handleLogoutDisconnect = async () => {
    setIsLoading(true);
    setError(null);

    try {
      log("--- Step 3: Logout & Disconnect ---");
      log(`Before logout: authenticated = ${authenticated}`);
      log(`Before logout: wallets = ${wallets.length}`);

      // Disconnect all wallets first
      if (wallets.length > 0) {
        log("Disconnecting all wallets...");
        for (const wallet of wallets) {
          try {
            await wallet.disconnect();
            log(
              `Disconnected: ${wallet.address.slice(0, 8)}... (${wallet.walletClientType})`,
            );
          } catch (e) {
            log(`Failed to disconnect ${wallet.address.slice(0, 8)}...: ${e}`);
          }
        }
      }

      // Then logout from Privy
      log("Calling logout()...");
      await logout();
      log("logout() completed");

      // Small delay to ensure state is fully cleared
      await new Promise((resolve) => setTimeout(resolve, 500));

      log("✅ Logout & Disconnect complete");
      log("Ready to connect a different wallet");
      setCurrentStep(4);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      log(`Logout failed: ${errorMessage}`);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset to start over
  const handleReset = async () => {
    setIsLoading(true);
    try {
      if (authenticated) {
        await logout();
      }
      for (const wallet of wallets) {
        try {
          await wallet.disconnect();
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
    clearLogs();
    setCurrentStep(1);
    setIsLoading(false);
    log("Reset complete - ready to start fresh");
  };

  const linkedWallets =
    user?.linkedAccounts
      ?.filter((a) => a.type === "wallet" && "address" in a)
      .map((a) => (a as { address: string }).address) ?? [];

  // Update current step based on state
  const getActiveStep = () => {
    if (!address && !authenticated && currentStep < 4) return 1;
    if (address && !authenticated && currentStep < 3) return 2;
    if (authenticated && currentStep === 2) return 3;
    if (!address && !authenticated && currentStep >= 3) return 4;
    if (address && !authenticated && currentStep >= 4) return 5;
    return currentStep;
  };

  const { connectAsync } = useConnect()
  const prevAddressRef = useRef<string | undefined>(undefined)
  const [isProcessingAccountChange, setIsProcessingAccountChange] = useState(false)




  useEffect(() => {
    const handleAccountChange = async () => {
      if (!ready || !address) return

      if (prevAddressRef.current === undefined) {
        prevAddressRef.current = address
        return
      }

      if (prevAddressRef.current === address) return

      if (isProcessingAccountChange) return

      const oldAddress = prevAddressRef.current
      prevAddressRef.current = address

      log('--- WALLET ACCOUNT CHANGE DETECTED ---')
      log(`Previous: ${oldAddress}`)
      log(`New: ${address}`)
      setIsProcessingAccountChange(true)


      setError(null)

      try {
        handleLogoutDisconnect()

        log('Step 3: Calling connectAsync()...')
        await connectAsync({ connector: injected() })
        log('connectAsync() completed')
        console.log('wallets', wallets)

        log('Step 4: Attempting SIWE with new wallet...')
        await handleLoginSiwe()
      } catch (e: any) {
        log(`❌ FAILED: ${e.message}`)
        setError(e.message)
        log('NOTE: Cannot get linked embedded wallet with wallet B')
      }
      finally {
        setIsProcessingAccountChange(false)
      }
    }

    handleAccountChange()
  }, [address, ready])

  const activeStep = getActiveStep();

  return (
    <div className="max-w-4xl mx-auto p-5 min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-2">Privy SIWE Flow Test</h1>
      <p className="text-gray-600 mb-5">
        Test: Connect → SIWE Login → Logout/Disconnect → Connect Different
        Wallet → SIWE Login
      </p>

      {/* Current State */}
      <div className="bg-white p-4 rounded-lg mb-5 border border-gray-200 shadow-sm">
        <h3 className="font-semibold mb-3">Current State</h3>
        <div className="font-mono text-sm leading-relaxed grid grid-cols-2 gap-2">
          <div>
            privy ready: <b>{String(ready)}</b>
          </div>
          <div>
            authenticated:{" "}
            <b className={authenticated ? "text-green-600" : "text-red-600"}>
              {String(authenticated)}
            </b>
          </div>
          <div>
            total wallets: <b>{wallets.length}</b>
          </div>
          <div>
            external wallet:{" "}
            <b>
              {address
                ? `${address.slice(0, 6)}...${address.slice(-4)}`
                : "none"}
            </b>
          </div>
          <div className="col-span-2">
            linked wallets:{" "}
            <b>
              {linkedWallets.length > 0
                ? linkedWallets
                  .map((w) => `${w.slice(0, 6)}...${w.slice(-4)}`)
                  .join(", ")
                : "none"}
            </b>
          </div>
        </div>
      </div>

      {/* Steps Flow */}
      <div className="bg-white p-4 rounded-lg mb-5 border border-gray-200 shadow-sm">
        <h3 className="font-semibold mb-4">Test Flow</h3>
        <div className="flex items-center justify-between mb-6">
          {[1, 2, 3, 4, 5].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                  ${activeStep === step
                    ? "bg-blue-500 text-white ring-4 ring-blue-200"
                    : activeStep > step
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-500"
                  }`}
              >
                {activeStep > step ? "✓" : step}
              </div>
              {step < 5 && (
                <div
                  className={`w-12 h-1 mx-1 ${activeStep > step ? "bg-green-500" : "bg-gray-200"}`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-2 text-xs text-center text-gray-600">
          <div>Connect A</div>
          <div>SIWE A</div>
          <div>Logout</div>
          <div>Connect B</div>
          <div>SIWE B</div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <button
          onClick={handleConnect}
          disabled={isLoading || authenticated}
          className={`px-4 py-3 rounded-lg font-medium transition-all
            ${activeStep === 1 || activeStep === 4
              ? "bg-blue-500 hover:bg-blue-600 text-white ring-2 ring-blue-300"
              : "bg-blue-100 text-blue-700 hover:bg-blue-200"
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {activeStep === 4 ? "4. Connect Wallet B" : "1. Connect Wallet"}
        </button>

        <button
          onClick={handleLoginSiwe}
          disabled={isLoading || !address || authenticated}
          className={`px-4 py-3 rounded-lg font-medium transition-all
            ${activeStep === 2 || activeStep === 5
              ? "bg-green-500 hover:bg-green-600 text-white ring-2 ring-green-300"
              : "bg-green-100 text-green-700 hover:bg-green-200"
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {activeStep === 5 ? "5. SIWE Login B" : "2. SIWE Login"}
        </button>

        <button
          onClick={handleLogoutDisconnect}
          disabled={isLoading || !authenticated}
          className={`px-4 py-3 rounded-lg font-medium transition-all
            ${activeStep === 3
              ? "bg-orange-500 hover:bg-orange-600 text-white ring-2 ring-orange-300"
              : "bg-orange-100 text-orange-700 hover:bg-orange-200"
            }
            disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          3. Logout & Disconnect
        </button>

        <button
          onClick={handleReset}
          disabled={isLoading}
          className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-3 rounded-lg font-medium disabled:opacity-50"
        >
          Reset
        </button>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="bg-blue-50 border border-blue-300 p-4 rounded-lg mb-5 flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
          <b className="text-blue-700">Processing...</b>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-300 p-4 rounded-lg mb-5">
          <b className="text-red-700">Error:</b>
          <pre className="mt-1 text-red-700 whitespace-pre-wrap text-sm">
            {error}
          </pre>
        </div>
      )}

      {/* Logs */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-semibold">Logs</h3>
          <button
            onClick={clearLogs}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        </div>
        <div className="bg-gray-900 text-teal-400 p-4 rounded-lg font-mono text-xs max-h-80 overflow-auto leading-relaxed">
          {logs.length === 0 ? (
            <span className="text-gray-500">Click buttons to see logs...</span>
          ) : (
            logs.map((l, i) => (
              <div
                key={i}
                className={
                  l.includes("❌")
                    ? "text-red-400"
                    : l.includes("✅") || l.includes("🎉")
                      ? "text-green-400"
                      : ""
                }
              >
                {l}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
