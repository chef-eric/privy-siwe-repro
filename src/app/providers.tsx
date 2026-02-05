'use client';

import { PrivyProvider } from '@privy-io/react-auth';
import { WagmiProvider, createConfig } from '@privy-io/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http } from 'viem';
import { mainnet, bsc } from 'viem/chains';

const queryClient = new QueryClient();

// Configure wagmi with Privy
const wagmiConfig = createConfig({
  chains: [mainnet, bsc],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'YOUR_PRIVY_APP_ID'}
      config={{
        loginMethods: ['wallet'],
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          {children}
        </WagmiProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
