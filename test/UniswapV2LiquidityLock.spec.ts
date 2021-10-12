import { constants, Wallet } from 'ethers'
import { waffle, ethers } from 'hardhat'

import { Fixture } from 'ethereum-waffle'
import {
  MockTimeNonfungiblePositionManager,
  TestERC20,
  IWETH9,
  IUniswapV3Factory,
  SwapRouter,
  UniswapV3LiquidityLocker,
} from '../typechain'
import completeFixture from './shared/completeFixture'
import { FeeAmount, TICK_SPACINGS } from './shared/constants'
import { encodePriceSqrt } from './shared/encodePriceSqrt'
import { expect } from './shared/expect'
import { getMaxTick, getMinTick } from './shared/ticks'
import { expandTo18Decimals } from './shared/expandTo18Decimals'
describe('UniswapV3LiquidityLocker', () => {
  let wallets: Wallet[]
  let wallet: Wallet, other: Wallet
  let liquidityLocker: UniswapV3LiquidityLocker

  const nftFixture: Fixture<{
    nft: MockTimeNonfungiblePositionManager
    factory: IUniswapV3Factory,
    liquidityLocker: UniswapV3LiquidityLocker,
    tokens: [TestERC20, TestERC20, TestERC20]
    weth9: IWETH9
    router: SwapRouter
  }> = async (wallets, provider) => {
    const { weth9, factory, tokens, nft, router, liquidityLocker } = await completeFixture(wallets, provider)

    // approve & fund wallets
    for (const token of tokens) {
      await token.approve(nft.address, constants.MaxUint256)
      await token.connect(other).approve(nft.address, constants.MaxUint256)
      await token.transfer(other.address, expandTo18Decimals(1_000_000))
    }

    return {
      nft,
      factory,
      liquidityLocker,
      tokens,
      weth9,
      router,
    }
  }

  let nft: MockTimeNonfungiblePositionManager
  let tokens: [TestERC20, TestERC20, TestERC20]

  let loadFixture: ReturnType<typeof waffle.createFixtureLoader>

  before('create fixture loader', async () => {
    wallets = await (ethers as any).getSigners()
    ;[wallet, other] = wallets

    loadFixture = waffle.createFixtureLoader(wallets)
  })

  beforeEach('load fixture', async () => {
    ;({ nft,liquidityLocker, tokens} = await loadFixture(nftFixture))
  })

  describe('Uniswap V3 Locker', () => {
    const tokenId = 1
    beforeEach('create a position', async () => {
      await nft.createAndInitializePoolIfNecessary(
        tokens[0].address,
        tokens[1].address,
        FeeAmount.MEDIUM,
        encodePriceSqrt(1, 1)
      )

      await nft.mint({
        token0: tokens[0].address,
        token1: tokens[1].address,
        fee: FeeAmount.MEDIUM,
        tickLower: getMinTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        tickUpper: getMaxTick(TICK_SPACINGS[FeeAmount.MEDIUM]),
        recipient: other.address,
        amount0Desired: 100,
        amount1Desired: 100,
        amount0Min: 0,
        amount1Min: 0,
        deadline: 1,
      })

    })

    it('Mints ERC20 after transferring NFT', async () => {
      
      //Given: Minted NFT with a given liquidity
      const { liquidity } = await nft.positions(tokenId);
      
      //When: NFT is tranferred to locker contract
      await nft.connect(other)['safeTransferFrom(address,address,uint256)'](other.address, liquidityLocker.address, tokenId);

      //Then: Locker Contract mints "liquidity" amount of tokens
      expect(await liquidityLocker.balanceOf(other.address)).to.equal(liquidity);
    
    
    })

  })

});