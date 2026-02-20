import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('should render children text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should be disabled when isDisabled is true', () => {
    render(<Button isDisabled>Click me</Button>);
    expect(screen.getByText('Click me').closest('button')).toBeDisabled();
  });

  it('should show spinner when isLoading is true', () => {
    render(<Button isLoading>Click me</Button>);
    expect(screen.getByText('Click me').closest('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('should not call onClick when disabled', async () => {
    const handleClick = vi.fn();
    render(<Button isDisabled onClick={handleClick}>Click me</Button>);
    await userEvent.click(screen.getByText('Click me'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
