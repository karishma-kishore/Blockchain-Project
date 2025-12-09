// SDC Token Configuration for Blockchain-Project
// Contract deployed on Polygon Amoy Testnet

const SDC_CONFIG = {
    // Contract address from deployment.json
    CONTRACT_ADDRESS: "0x00485658Ba58bBD39F18a419FCE4F8488b7e136d",

    // Polygon Amoy Testnet
    CHAIN_ID: 80002,
    CHAIN_ID_HEX: "0x13882",

    // Network configuration for adding to MetaMask
    NETWORK_CONFIG: {
        chainId: "0x13882",
        chainName: "Polygon Amoy Testnet",
        nativeCurrency: {
            name: "POL",
            symbol: "POL",
            decimals: 18
        },
        rpcUrls: ["https://rpc-amoy.polygon.technology"],
        blockExplorerUrls: ["https://amoy.polygonscan.com"]
    },

    // Minimal ABI for frontend interactions
    ABI: [
        "function balanceOf(address account) view returns (uint256)",
        "function transfer(address to, uint256 amount) returns (bool)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function name() view returns (string)",
        "event Transfer(address indexed from, address indexed to, uint256 value)"
    ],

    // Goodies catalog - educational software subscriptions
    GOODIES: [
        {
            id: "github-student",
            name: "GitHub Student Developer Pack",
            description: "Free access to developer tools, cloud credits, and learning resources",
            cost: 50,
            icon: "mdi-github",
            category: "Development"
        },
        {
            id: "jetbrains-license",
            name: "JetBrains IDE License",
            description: "1-year license for IntelliJ IDEA, PyCharm, WebStorm, and more",
            cost: 100,
            icon: "mdi-code-braces",
            category: "Development"
        },
        {
            id: "coursera-course",
            name: "Coursera Course Access",
            description: "Access to any single Coursera course with certificate",
            cost: 75,
            icon: "mdi-school",
            category: "Learning"
        },
        {
            id: "linkedin-premium",
            name: "LinkedIn Learning Premium",
            description: "3-month premium access to LinkedIn Learning courses",
            cost: 80,
            icon: "mdi-linkedin",
            category: "Career"
        },
        {
            id: "aws-credits",
            name: "AWS Cloud Credits",
            description: "$50 in AWS cloud computing credits",
            cost: 60,
            icon: "mdi-cloud",
            category: "Cloud"
        },
        {
            id: "figma-pro",
            name: "Figma Pro Subscription",
            description: "6-month Figma Pro subscription for design projects",
            cost: 90,
            icon: "mdi-pencil-ruler",
            category: "Design"
        }
    ]
};

// Make available globally
if (typeof window !== 'undefined') {
    window.SDC_CONFIG = SDC_CONFIG;
}
