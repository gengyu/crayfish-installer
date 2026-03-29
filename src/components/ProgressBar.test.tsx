import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProgressBar from './ProgressBar'

describe('ProgressBar', () => {
  it('renders progress, stage and detail text', () => {
    const { container } = render(
      <ProgressBar progress={42} stage="正在准备环境" detail="正在检查 Node.js 与 pnpm" />
    )

    expect(screen.getByText('正在准备环境')).toBeInTheDocument()
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText('正在检查 Node.js 与 pnpm')).toBeInTheDocument()
    expect(container.querySelector('[style="width: 42%;"]')).not.toBeNull()
  })

  it('omits detail text when detail is not provided', () => {
    render(<ProgressBar progress={100} stage="安装完成" />)

    expect(screen.getByText('安装完成')).toBeInTheDocument()
    expect(screen.queryByText(/Node\.js/)).not.toBeInTheDocument()
  })
})
