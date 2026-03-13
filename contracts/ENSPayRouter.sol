// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

interface ISwapRouter02 {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

contract ENSPayRouter {
    error InvalidRecipient();
    error InvalidAmount();
    error InvalidToken();
    error TokenTransferFailed();
    error TokenApproveFailed();

    uint256 public constant DEFAULT_SLIPPAGE_BPS = 50; // 0.5%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint24 public constant UNISWAP_POOL_FEE = 3000;

    address public immutable usdc;
    address public immutable swapRouter02;

    event PaymentRouted(
        address indexed sender,
        address indexed recipient,
        string ensName,
        address token,
        uint256 amount
    );

    event SwapRouted(
        address indexed sender,
        address indexed recipient,
        string ensName,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(address _usdc, address _swapRouter02) {
        if (_usdc == address(0) || _swapRouter02 == address(0)) revert InvalidToken();
        usdc = _usdc;
        swapRouter02 = _swapRouter02;
    }

    function resolveAndPay(
        string calldata ensName,
        address recipient,
        uint256 amount
    ) external {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        bool ok = IERC20(usdc).transferFrom(msg.sender, recipient, amount);
        if (!ok) revert TokenTransferFailed();

        emit PaymentRouted(msg.sender, recipient, ensName, usdc, amount);
    }

    function resolveAndSwap(
        string calldata ensName,
        address recipient,
        address inputToken,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (inputToken == address(0)) revert InvalidToken();
        if (amountIn == 0) revert InvalidAmount();

        bool transferred = IERC20(inputToken).transferFrom(msg.sender, address(this), amountIn);
        if (!transferred) revert TokenTransferFailed();

        bool approved = IERC20(inputToken).approve(swapRouter02, amountIn);
        if (!approved) revert TokenApproveFailed();

        ISwapRouter02.ExactInputSingleParams memory params = ISwapRouter02.ExactInputSingleParams({
            tokenIn: inputToken,
            tokenOut: usdc,
            fee: UNISWAP_POOL_FEE,
            recipient: recipient,
            amountIn: amountIn,
            amountOutMinimum: amountOutMinimum,
            sqrtPriceLimitX96: 0
        });

        amountOut = ISwapRouter02(swapRouter02).exactInputSingle(params);
        emit SwapRouted(msg.sender, recipient, ensName, inputToken, usdc, amountIn, amountOut);
    }

    function applyDefaultSlippage(uint256 quotedOut) external pure returns (uint256) {
        return (quotedOut * (BPS_DENOMINATOR - DEFAULT_SLIPPAGE_BPS)) / BPS_DENOMINATOR;
    }
}
