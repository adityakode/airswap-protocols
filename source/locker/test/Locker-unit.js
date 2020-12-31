const Locker = artifacts.require('Locker')
const MockContract = artifacts.require('MockContract')
const { takeSnapshot, revertToSnapshot } = require('@airswap/test-utils').time
const { emitted, reverted, equal } = require('@airswap/test-utils').assert

contract('Locker Unit Tests', async accounts => {
  const [ownerAddress, aliceAddress, bobAddress] = accounts
  const SECONDS_IN_DAY = 86400
  const THROTTLING_PERCENTAGE = 10
  const THROTTLING_DURATION = 7 * SECONDS_IN_DAY
  const THROTTLING_BALANCE = 100

  let lockerToken
  let locker
  let snapshotId

  beforeEach(async () => {
    const snapshot = await takeSnapshot()
    snapshotId = snapshot['result']
  })

  afterEach(async () => {
    await revertToSnapshot(snapshotId)
  })

  describe('Setup contracts', async () => {
    it('Check constructor', async () => {
      locker = await Locker.new(
        lockerToken.address,
        'Locker',
        'LCK',
        4,
        THROTTLING_PERCENTAGE,
        THROTTLING_DURATION,
        THROTTLING_BALANCE,
        {
          from: ownerAddress,
        }
      )
      equal((await locker.name()).toString(), 'Locker')
      equal((await locker.symbol()).toString(), 'LCK')
      equal((await locker.decimals()).toString(), '4')
      equal((await locker.totalSupply()).toString(), '0')
      equal(await locker.token(), lockerToken.address)
      equal(
        (await locker.throttlingPercentage()).toString(),
        THROTTLING_PERCENTAGE
      )
      equal((await locker.throttlingDuration()).toString(), THROTTLING_DURATION)
    })

    it('Mints some tokens for Alice and Bob', async () => {
      emitted(await lockerToken.mint(aliceAddress, 100000000), 'Transfer')
      emitted(await lockerToken.mint(bobAddress, 100000000), 'Transfer')
    })
    it('Approves tokens for Alice and Bob', async () => {
      emitted(
        await lockerToken.approve(locker.address, 100000000, {
          from: aliceAddress,
        }),
        'Approval'
      )
      emitted(
        await lockerToken.approve(locker.address, 100000000, {
          from: bobAddress,
        }),
        'Approval'
      )
    })
  })

  describe('Locking and unlocking', async () => {
    it('Alice locks some tokens', async () => {
      emitted(
        await locker.lock(1000000, {
          from: aliceAddress,
        }),
        'Lock'
      )
      equal((await locker.balanceOf(aliceAddress)).toString(), '1000000')
      equal((await locker.totalSupply()).toString(), '1000000')
    })
    it('Alice attempts to unlock too many tokens', async () => {
      await reverted(
        locker.unlock(100001, {
          from: aliceAddress,
        }),
        'AMOUNT_EXCEEDS_LIMIT'
      )
    })
    it('Alice attempts to unlock 10% of her tokens', async () => {
      emitted(
        await locker.unlock(100000, {
          from: aliceAddress,
        }),
        'Unlock'
      )
      equal((await locker.balanceOf(aliceAddress)).toString(), '900000')
      equal((await locker.totalSupply()).toString(), '900000')
    })
    it('Bob locks some tokens', async () => {
      emitted(
        await locker.lock(500000, {
          from: bobAddress,
        }),
        'Lock'
      )
      equal((await locker.balanceOf(bobAddress)).toString(), '500000')
      equal((await locker.totalSupply()).toString(), '1400000')
    })
    it('Bob tries to lock more than he has', async () => {
      await reverted(
        locker.lock(100000000, {
          from: bobAddress,
        }),
        'BALANCE_INSUFFICIENT'
      )
    })
    it('Alice locks some tokens for Bob', async () => {
      emitted(
        await locker.lockFor(bobAddress, 200000, {
          from: aliceAddress,
        }),
        'Lock'
      )
      equal((await locker.balanceOf(bobAddress)).toString(), '700000')
      equal((await locker.totalSupply()).toString(), '1600000')
    })
    it('Alice tries to lock more than she has for Bob', async () => {
      await reverted(
        locker.lockFor(bobAddress, 100000000, {
          from: aliceAddress,
        }),
        'BALANCE_INSUFFICIENT'
      )
    })
    it('Updates percentage, duration, and lowest', async () => {
      emitted(
        await locker.setThrottlingPercentage(100, {
          from: ownerAddress,
        }),
        'SetThrottlingPercentage'
      )
      emitted(
        await locker.setThrottlingDuration(SECONDS_IN_DAY, {
          from: ownerAddress,
        }),
        'SetThrottlingDuration'
      )
      emitted(
        await locker.setThrottlingBalance(100000000, {
          from: ownerAddress,
        }),
        'SetThrottlingBalance'
      )
    })
    it('Alice tries to unlock more than she has locked', async () => {
      await reverted(
        locker.unlock(100000000, {
          from: aliceAddress,
        }),
        'BALANCE_INSUFFICIENT'
      )
    })
  })
})
