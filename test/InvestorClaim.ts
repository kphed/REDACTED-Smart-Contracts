import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { BTRFLY, CRV, InvestorClaimV2, PBTRFLY, REDACTEDTreasury, WxBTRFLY } from '../typechain'
import {
  BTRFLY_ADDRESS,
  GNOSIS_SAFE_ADDRESS,
  PBTRFLY_ADDRESS,
  STAKING_ADDRESS,
  TREASURY_ADDRESS,
  TREASURY_MANAGER,
  XBTRFLY_ADDRESS,
} from './constants'
export const impersonateAddressAndReturnSigner = async (
  networkAdmin: SignerWithAddress,
  address: string,
) => {
  await ethers.provider.send('hardhat_impersonateAccount', [address]) // get some eth from a miner
  const account = await ethers.getSigner(address)
  await networkAdmin.sendTransaction({
    to: address,
    value: ethers.utils.parseEther('1.0'),
  })
  return account
}
describe('Test Investor Claim', () => {
  let investorClaim: InvestorClaimV2
  let wsBTRFLY: any
  let treasury: REDACTEDTreasury
  let local: SignerWithAddress
  let manager: SignerWithAddress
  let investor: SignerWithAddress
  let btrfly: BTRFLY
  let pBtrfly: PBTRFLY
  let crv: CRV

  beforeEach(async () => {
    ;[local] = await ethers.getSigners()
    treasury = await ethers.getContractAt('REDACTEDTreasury', TREASURY_ADDRESS)
    manager = await impersonateAddressAndReturnSigner(local, TREASURY_MANAGER)
    investor = await impersonateAddressAndReturnSigner(
      local,
      '0x562E4E25F4bb991C66cDb74C4AF3957E0fFd3f89',
    )
    crv = await ethers.getContractAt('CRV', '0xd533a949740bb3306d119cc777fa900ba034cd52')
    btrfly = await ethers.getContractAt('BTRFLY', BTRFLY_ADDRESS)

    const WSBTRFLY = await ethers.getContractFactory('wxBTRFLY')
    pBtrfly = await ethers.getContractAt('PBTRFLY', PBTRFLY_ADDRESS)
    wsBTRFLY = await WSBTRFLY.deploy(STAKING_ADDRESS, BTRFLY_ADDRESS, XBTRFLY_ADDRESS)
    const InvestorClaim = await ethers.getContractFactory('InvestorClaimV2')
    investorClaim = await InvestorClaim.deploy(
      BTRFLY_ADDRESS,
      crv.address,
      TREASURY_ADDRESS,
      GNOSIS_SAFE_ADDRESS,
      wsBTRFLY.address,
      STAKING_ADDRESS,
      ethers.utils.parseEther('3000000000'),
    )
  })

  it('investor can redeem their pB for wsB', async () => {
    const pBalance = ethers.utils.formatEther(await pBtrfly.balanceOf(investor.address))
    expect(Number(pBalance)).to.be.greaterThan(0)
  })
})
