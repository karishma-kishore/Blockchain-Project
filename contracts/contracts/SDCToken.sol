// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SDCToken
 * @dev SunDevilSync Coin (SDC) - ERC-20 token for the SunDevilSync ecosystem
 *
 * Features:
 * - ERC-20 compliant fungible token
 * - Role-based access control for minting
 * - Pausable for emergency stops
 * - Burnable tokens
 * - ERC-20 Permit for gasless approvals
 * - Reward distribution for event participation
 */
contract SDCToken is
    ERC20,
    ERC20Burnable,
    ERC20Permit,
    AccessControl,
    Pausable,
    ReentrancyGuard
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // Token configuration
    uint8 private constant DECIMALS = 18;

    // Reward amounts (in wei, 1 SDC = 10^18 wei)
    uint256 public constant RSVP_REWARD = 10 * 10**DECIMALS;           // 10 SDC for RSVP
    uint256 public constant ATTENDANCE_REWARD = 20 * 10**DECIMALS;     // 20 SDC for attendance
    uint256 public constant REFERRAL_REWARD = 5 * 10**DECIMALS;        // 5 SDC for referral
    uint256 public constant BADGE_EARNED_REWARD = 15 * 10**DECIMALS;   // 15 SDC for earning badge

    // Supply tracking
    uint256 public totalMinted;
    uint256 public totalBurned;

    // Optional max supply (0 = unlimited)
    uint256 public maxSupply;

    // Reward tracking per user
    mapping(address => uint256) public totalRewardsEarned;
    mapping(address => uint256) public rewardCount;

    // Events
    event TokensMinted(
        address indexed to,
        uint256 amount,
        string reason,
        uint256 timestamp
    );

    event RewardDistributed(
        address indexed recipient,
        uint256 amount,
        string rewardType,
        bytes32 indexed referenceId,
        uint256 timestamp
    );

    event MaxSupplyUpdated(
        uint256 oldMaxSupply,
        uint256 newMaxSupply
    );

    event TokensBurned(
        address indexed from,
        uint256 amount,
        uint256 timestamp
    );

    /**
     * @dev Constructor
     * @param admin Address to receive admin role
     * @param minter Address to receive minter role (typically backend service)
     * @param initialSupply Initial token supply to mint to admin (in whole tokens)
     * @param _maxSupply Maximum token supply (0 for unlimited)
     */
    constructor(
        address admin,
        address minter,
        uint256 initialSupply,
        uint256 _maxSupply
    ) ERC20("SunDevilSync Coin", "SDC") ERC20Permit("SunDevilSync Coin") {
        require(admin != address(0), "Invalid admin address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);

        if (minter != address(0) && minter != admin) {
            _grantRole(MINTER_ROLE, minter);
        }

        maxSupply = _maxSupply * 10**DECIMALS;

        // Mint initial supply to admin
        if (initialSupply > 0) {
            uint256 initialAmount = initialSupply * 10**DECIMALS;
            require(maxSupply == 0 || initialAmount <= maxSupply, "Initial supply exceeds max supply");
            _mint(admin, initialAmount);
            totalMinted = initialAmount;
            emit TokensMinted(admin, initialAmount, "Initial supply", block.timestamp);
        }
    }

    /**
     * @dev Returns the number of decimals used
     */
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /**
     * @dev Mint tokens to an address
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     * @param reason Reason for minting
     */
    function mint(
        address to,
        uint256 amount,
        string calldata reason
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(
            maxSupply == 0 || totalMinted + amount <= maxSupply,
            "Would exceed max supply"
        );

        _mint(to, amount);
        totalMinted += amount;

        emit TokensMinted(to, amount, reason, block.timestamp);
    }

    /**
     * @dev Distribute reward tokens to a user
     * @param recipient Recipient address
     * @param amount Reward amount (in wei)
     * @param rewardType Type of reward (e.g., "RSVP", "ATTENDANCE", "REFERRAL")
     * @param referenceId Reference ID (e.g., event ID hash)
     */
    function distributeReward(
        address recipient,
        uint256 amount,
        string calldata rewardType,
        bytes32 referenceId
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be positive");
        require(
            maxSupply == 0 || totalMinted + amount <= maxSupply,
            "Would exceed max supply"
        );

        _mint(recipient, amount);
        totalMinted += amount;
        totalRewardsEarned[recipient] += amount;
        rewardCount[recipient]++;

        emit RewardDistributed(recipient, amount, rewardType, referenceId, block.timestamp);
    }

    /**
     * @dev Batch distribute rewards to multiple users
     * @param recipients Array of recipient addresses
     * @param amounts Array of reward amounts
     * @param rewardType Type of reward
     * @param referenceId Reference ID for all rewards
     */
    function batchDistributeReward(
        address[] calldata recipients,
        uint256[] calldata amounts,
        string calldata rewardType,
        bytes32 referenceId
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        require(recipients.length <= 100, "Batch too large");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }

        require(
            maxSupply == 0 || totalMinted + totalAmount <= maxSupply,
            "Would exceed max supply"
        );

        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient");
            require(amounts[i] > 0, "Amount must be positive");

            _mint(recipients[i], amounts[i]);
            totalRewardsEarned[recipients[i]] += amounts[i];
            rewardCount[recipients[i]]++;

            emit RewardDistributed(recipients[i], amounts[i], rewardType, referenceId, block.timestamp);
        }

        totalMinted += totalAmount;
    }

    /**
     * @dev Update max supply (can only increase or set to unlimited)
     * @param newMaxSupply New maximum supply (0 for unlimited)
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 newMax = newMaxSupply * 10**DECIMALS;
        require(
            newMax == 0 || newMax >= totalMinted,
            "New max supply must be >= total minted"
        );

        emit MaxSupplyUpdated(maxSupply, newMax);
        maxSupply = newMax;
    }

    /**
     * @dev Override burn to track total burned
     */
    function burn(uint256 amount) public override {
        super.burn(amount);
        totalBurned += amount;
        emit TokensBurned(_msgSender(), amount, block.timestamp);
    }

    /**
     * @dev Override burnFrom to track total burned
     */
    function burnFrom(address account, uint256 amount) public override {
        super.burnFrom(account, amount);
        totalBurned += amount;
        emit TokensBurned(account, amount, block.timestamp);
    }

    /**
     * @dev Pause token transfers
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    /**
     * @dev Get user's reward statistics
     * @param user User address
     * @return balance Current token balance
     * @return rewards Total rewards earned
     * @return count Number of rewards received
     */
    function getUserStats(address user) external view returns (
        uint256 balance,
        uint256 rewards,
        uint256 count
    ) {
        return (
            balanceOf(user),
            totalRewardsEarned[user],
            rewardCount[user]
        );
    }

    /**
     * @dev Get token supply statistics
     * @return current Current total supply
     * @return minted Total ever minted
     * @return burned Total ever burned
     * @return max Maximum supply (0 = unlimited)
     */
    function getSupplyStats() external view returns (
        uint256 current,
        uint256 minted,
        uint256 burned,
        uint256 max
    ) {
        return (
            totalSupply(),
            totalMinted,
            totalBurned,
            maxSupply
        );
    }

    /**
     * @dev Get remaining mintable supply
     * @return Remaining supply that can be minted (type(uint256).max if unlimited)
     */
    function remainingMintable() external view returns (uint256) {
        if (maxSupply == 0) {
            return type(uint256).max;
        }
        return maxSupply > totalMinted ? maxSupply - totalMinted : 0;
    }

    /**
     * @dev Hook to check pause status before transfers
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal override whenNotPaused {
        super._update(from, to, value);
    }
}
