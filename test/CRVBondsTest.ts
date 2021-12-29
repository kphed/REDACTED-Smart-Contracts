import { expect } from 'chai'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { mineBlocks, getTREASURY, getBondingCalculator } from './utils'
import { BTRFLY, ERC20, REDACTEDBondDepository, REDACTEDTreasury } from '../typechain'
import {
  BTRFLY_ADDRESS,
  CRV_ADDRESS,
  CRV_WHALE,
  GNOSIS,
  TREASURY_ADDRESS,
  ZERO_ADDRESS,
} from './constants'
import { BigNumber } from 'ethers'

export const impersonateAddressAndReturnSigner = async (
  networkAdmin: SignerWithAddress,
  address: string,
) => {
  await ethers.provider.send('hardhat_impersonateAccount', [address]) // get some eth from a miner
  const account = await ethers.getSigner(address)
  await networkAdmin.sendTransaction({
    to: address,
    value: ethers.utils.parseEther('100'),
  })
  return account
}

describe('LIVE CRV BOND DEPOSITORY', () => {
  /**
   * @dev EAO / DAO addresses
   */
  let dao: SignerWithAddress
  let olympusDao: SignerWithAddress
  let localSigner: SignerWithAddress
  let gnosis: SignerWithAddress
  let crvWhale: SignerWithAddress
  let recipient: SignerWithAddress

  /**
   * @dev contract address
   */
  let treasuryContract: REDACTEDTreasury
  let btrfly: BTRFLY
  let crv: BTRFLY
  let crvBond: REDACTEDBondDepository

  /**
   * @dev parameters for bond
   */

  const BCV = '55'
  const VESTING = '33110'
  const MINPRICE = '8500'
  const MAXPAYOUT = '100'
  const FEE = '9500'
  const MAXDEBT = ethers.utils.parseEther('10000000000000000000000000000')
  const TITHE = '500'
  const INITIALDEBT = '0'

  beforeEach(async () => {
    ;[localSigner, olympusDao, recipient] = await ethers.getSigners()
    // impersonate addresses
    crvWhale = await impersonateAddressAndReturnSigner(localSigner, CRV_WHALE)
    gnosis = await impersonateAddressAndReturnSigner(localSigner, GNOSIS)

    // get Treasury contract
    treasuryContract = await ethers.getContractAt('REDACTEDTreasury', TREASURY_ADDRESS, gnosis)

    // get crv contract
    crv = await ethers.getContractAt('BTRFLY', CRV_ADDRESS)

    const crvFloor = await treasuryContract.getFloor(CRV_ADDRESS)
    console.log('THE FLOOR: ', crvFloor)

    if (crvFloor.eq(BigNumber.from(0))) {
      // set crv floor to 250 million
      await treasuryContract.connect(gnosis).setFloor(crv.address, BigNumber.from('250000000'))
    }
    // deploy BOND
    const CRVBONDFACTORY = await ethers.getContractFactory('REDACTEDBondDepository')
    crvBond = await CRVBONDFACTORY.deploy(
      BTRFLY_ADDRESS,
      CRV_ADDRESS,
      TREASURY_ADDRESS,
      gnosis.address,
      ZERO_ADDRESS,
      olympusDao.address,
      olympusDao.address,
    )
    await crvBond.deployed()

    // queue the bonds
    await treasuryContract.queue(BigNumber.from(0), crvBond.address)

    await treasuryContract.toggle(BigNumber.from(0), crvBond.address, ZERO_ADDRESS)
  })

  it('loads contracts and signers', async () => {
    console.log('crv whale balance: ', await crv.balanceOf(crvWhale.address))
    console.log(' gnosis address: ', gnosis.address)
    expect(gnosis.address).to.be.eq(await treasuryContract.manager())
  })

  it('test correct terms', async () => {
    // init the terms
    await crvBond.initializeBondTerms(
      BCV,
      VESTING,
      MINPRICE,
      MAXPAYOUT,
      FEE,
      MAXDEBT,
      TITHE,
      INITIALDEBT,
    )
    // crv holder bonding
    await crv.connect(crvWhale).approve(crvBond.address, ethers.constants.MaxUint256)
    await crvBond
      .connect(crvWhale)
      .deposit(ethers.utils.parseEther('1'), BigNumber.from(10000), crvWhale.address)
  })
})
