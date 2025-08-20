import { GoldenDatasetEntry } from '../types/golden-dataset';

/**
 * Sample Golden Dataset Entries
 * 
 * These entries represent various complexity levels and scenarios
 * for testing the KPC Knowledge System
 */

export const sampleEntries: GoldenDatasetEntry[] = [
  // Basic Level Entries
  {
    id: 'basic-button-001',
    name: 'Simple Button Component',
    description: 'A basic button with text and click handler',
    category: 'basic',
    framework: 'multi-framework',
    requirement: {
      naturalLanguage: 'Create a button that says "Click me" and shows an alert when clicked',
      structuredRequirements: {
        components: [
          {
            type: 'Button',
            props: [
              { name: 'children', type: 'string', required: true, defaultValue: 'Click me' },
              { name: 'onClick', type: 'function', required: true }
            ],
            events: [
              { name: 'onClick', type: 'MouseEvent', description: 'Triggered when button is clicked' }
            ]
          }
        ],
        layout: { type: 'flow' },
        interactions: [
          {
            type: 'click',
            trigger: 'button',
            action: 'alert("Button clicked!")',
            target: 'button'
          }
        ],
        styling: {
          theme: 'default',
          colors: { primary: '#007bff' }
        },
        accessibility: {
          level: 'AA',
          features: [
            { type: 'keyboard-nav', description: 'Button is focusable and activatable with Enter/Space', implementation: 'native button element' }
          ],
          screenReaderSupport: true,
          keyboardNavigation: true,
          colorContrast: true
        },
        performance: {
          maxRenderTime: 16,
          maxBundleSize: 1024,
          lazyLoading: false,
          caching: false
        }
      },
      constraints: [
        {
          type: 'component-whitelist',
          description: 'Only use approved button components',
          rule: { allowedComponents: ['Button'] }
        }
      ],
      context: {
        userType: 'developer',
        experienceLevel: 'beginner',
        projectType: 'web-app'
      }
    },
    expectedUAST: {
      type: 'component',
      name: 'Button',
      props: {
        onClick: '() => alert("Button clicked!")'
      },
      children: [
        {
          type: 'text',
          name: 'text',
          children: [],
          metadata: { framework: 'multi-framework' }
        }
      ],
      metadata: {
        framework: 'multi-framework',
        semanticRole: 'button',
        accessibility: {
          role: 'button',
          focusable: true
        }
      }
    },
    expectedCode: {
      react: {
        component: `import React from 'react';

interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}

export const SimpleButton: React.FC<ButtonProps> = ({ children, onClick }) => {
  return (
    <button onClick={onClick} className="btn btn-primary">
      {children}
    </button>
  );
};

// Usage
export default function App() {
  const handleClick = () => {
    alert("Button clicked!");
  };

  return <SimpleButton onClick={handleClick}>Click me</SimpleButton>;
}`,
        styles: `.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn:hover {
  opacity: 0.9;
}

.btn:focus {
  outline: 2px solid #0056b3;
  outline-offset: 2px;
}`,
        types: `export interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
}`,
        tests: `import { render, screen, fireEvent } from '@testing-library/react';
import { SimpleButton } from './SimpleButton';

describe('SimpleButton', () => {
  it('renders with correct text', () => {
    const handleClick = jest.fn();
    render(<SimpleButton onClick={handleClick}>Click me</SimpleButton>);
    
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<SimpleButton onClick={handleClick}>Click me</SimpleButton>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is keyboard accessible', () => {
    const handleClick = jest.fn();
    render(<SimpleButton onClick={handleClick}>Click me</SimpleButton>);
    
    const button = screen.getByRole('button');
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});`,
        stories: `import type { Meta, StoryObj } from '@storybook/react';
import { SimpleButton } from './SimpleButton';

const meta: Meta<typeof SimpleButton> = {
  title: 'Components/SimpleButton',
  component: SimpleButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Click me',
    onClick: () => alert('Button clicked!'),
  },
};

export const LongText: Story = {
  args: {
    children: 'This is a button with longer text',
    onClick: () => alert('Button clicked!'),
  },
};`
      },
      vue: {
        component: `<template>
  <button 
    @click="handleClick" 
    class="btn btn-primary"
    type="button"
  >
    <slot>{{ children }}</slot>
  </button>
</template>

<script setup lang="ts">
interface Props {
  children?: string;
  onClick?: () => void;
}

const props = withDefaults(defineProps<Props>(), {
  children: 'Click me'
});

const handleClick = () => {
  if (props.onClick) {
    props.onClick();
  }
};
</script>

<style scoped>
.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn:hover {
  opacity: 0.9;
}

.btn:focus {
  outline: 2px solid #0056b3;
  outline-offset: 2px;
}
</style>`,
        tests: `import { mount } from '@vue/test-utils';
import SimpleButton from './SimpleButton.vue';

describe('SimpleButton', () => {
  it('renders with correct text', () => {
    const wrapper = mount(SimpleButton, {
      props: {
        children: 'Click me'
      }
    });
    
    expect(wrapper.text()).toBe('Click me');
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    const wrapper = mount(SimpleButton, {
      props: {
        onClick
      }
    });
    
    await wrapper.trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});`
      },
      intact: {
        component: `import { Component, template } from 'intact';

export interface SimpleButtonProps {
  children?: string;
  onClick?: () => void;
}

export default class SimpleButton extends Component<SimpleButtonProps> {
  static template = template(\`
    <button 
      ev-click={{ self.handleClick }}
      class="btn btn-primary"
      type="button"
    >
      {{ self.get('children') || 'Click me' }}
    </button>
  \`);

  static defaults() {
    return {
      children: 'Click me'
    };
  }

  handleClick() {
    const onClick = this.get('onClick');
    if (onClick) {
      onClick();
    }
  }
}`,
        styles: `.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn:hover {
  opacity: 0.9;
}

.btn:focus {
  outline: 2px solid #0056b3;
  outline-offset: 2px;
}`
      }
    },
    testCases: [
      {
        id: 'button-render-test',
        name: 'Button Renders Correctly',
        type: 'unit',
        description: 'Verify button renders with correct text and attributes',
        steps: [
          { action: 'render', target: 'SimpleButton', input: { children: 'Click me' } }
        ],
        assertions: [
          { type: 'exists', target: 'button', expected: true },
          { type: 'text', target: 'button', expected: 'Click me' },
          { type: 'attribute', target: 'button', expected: { type: 'button' } }
        ],
        expectedResults: [
          { type: 'render', expected: 'Button element with correct text and attributes' }
        ]
      },
      {
        id: 'button-click-test',
        name: 'Button Click Handler',
        type: 'interaction',
        description: 'Verify button click triggers the onClick handler',
        steps: [
          { action: 'render', target: 'SimpleButton' },
          { action: 'click', target: 'button' }
        ],
        assertions: [
          { type: 'event', target: 'onClick', expected: 'called' }
        ],
        expectedResults: [
          { type: 'interaction', expected: 'onClick handler called once' }
        ]
      },
      {
        id: 'button-accessibility-test',
        name: 'Button Accessibility',
        type: 'accessibility',
        description: 'Verify button meets accessibility requirements',
        steps: [
          { action: 'render', target: 'SimpleButton' },
          { action: 'focus', target: 'button' },
          { action: 'keypress', target: 'button', input: { key: 'Enter' } }
        ],
        assertions: [
          { type: 'accessibility', target: 'button', expected: { role: 'button', focusable: true } },
          { type: 'event', target: 'onClick', expected: 'called' }
        ],
        expectedResults: [
          { type: 'accessibility', expected: 'Button is keyboard accessible and has proper ARIA attributes' }
        ]
      }
    ],
    metadata: {
      difficulty: 1,
      estimatedTime: 15,
      tags: ['button', 'basic', 'interaction', 'accessibility'],
      author: 'KPC Team',
      reviewers: ['reviewer1', 'reviewer2'],
      validationStatus: 'validated',
      usageCount: 150,
      successRate: 0.98,
      commonErrors: ['Missing onClick handler', 'Incorrect button type'],
      relatedEntries: ['basic-input-001', 'basic-form-001']
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    version: '1.0.0'
  },

  // Intermediate Level Entry
  {
    id: 'intermediate-form-001',
    name: 'Contact Form with Validation',
    description: 'A contact form with multiple fields and client-side validation',
    category: 'intermediate',
    framework: 'multi-framework',
    requirement: {
      naturalLanguage: 'Create a contact form with name, email, and message fields. Include validation for required fields and email format. Show error messages and disable submit until form is valid.',
      structuredRequirements: {
        components: [
          {
            type: 'Form',
            props: [
              { name: 'onSubmit', type: 'function', required: true }
            ],
            children: [
              {
                type: 'Input',
                name: 'nameInput',
                props: [
                  { name: 'label', type: 'string', required: true, defaultValue: 'Name' },
                  { name: 'type', type: 'string', required: true, defaultValue: 'text' },
                  { name: 'required', type: 'boolean', required: true, defaultValue: true },
                  { name: 'value', type: 'string', required: false },
                  { name: 'onChange', type: 'function', required: true }
                ],
                validation: [
                  { type: 'required', rule: true, message: 'Name is required' }
                ]
              },
              {
                type: 'Input',
                name: 'emailInput',
                props: [
                  { name: 'label', type: 'string', required: true, defaultValue: 'Email' },
                  { name: 'type', type: 'string', required: true, defaultValue: 'email' },
                  { name: 'required', type: 'boolean', required: true, defaultValue: true },
                  { name: 'value', type: 'string', required: false },
                  { name: 'onChange', type: 'function', required: true }
                ],
                validation: [
                  { type: 'required', rule: true, message: 'Email is required' },
                  { type: 'pattern', rule: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email' }
                ]
              },
              {
                type: 'Textarea',
                name: 'messageInput',
                props: [
                  { name: 'label', type: 'string', required: true, defaultValue: 'Message' },
                  { name: 'required', type: 'boolean', required: true, defaultValue: true },
                  { name: 'value', type: 'string', required: false },
                  { name: 'onChange', type: 'function', required: true }
                ],
                validation: [
                  { type: 'required', rule: true, message: 'Message is required' }
                ]
              },
              {
                type: 'Button',
                name: 'submitButton',
                props: [
                  { name: 'type', type: 'string', required: true, defaultValue: 'submit' },
                  { name: 'disabled', type: 'boolean', required: false },
                  { name: 'children', type: 'string', required: true, defaultValue: 'Send Message' }
                ]
              }
            ]
          }
        ],
        layout: {
          type: 'flex',
          direction: 'column',
          spacing: '16px'
        },
        interactions: [
          {
            type: 'input',
            trigger: 'input field',
            action: 'validate and update state',
            conditions: ['on change', 'on blur']
          },
          {
            type: 'submit',
            trigger: 'form',
            action: 'validate all fields and submit if valid',
            conditions: ['all fields valid']
          }
        ],
        styling: {
          theme: 'default',
          colors: {
            primary: '#007bff',
            error: '#dc3545',
            success: '#28a745'
          }
        },
        accessibility: {
          level: 'AA',
          features: [
            { type: 'aria-labels', description: 'Form fields have proper labels', implementation: 'label elements and aria-describedby' },
            { type: 'focus-management', description: 'Focus moves logically through form', implementation: 'proper tab order' },
            { type: 'screen-reader', description: 'Error messages announced to screen readers', implementation: 'aria-live regions' }
          ],
          screenReaderSupport: true,
          keyboardNavigation: true,
          colorContrast: true
        },
        performance: {
          maxRenderTime: 50,
          maxBundleSize: 5120,
          lazyLoading: false,
          caching: true
        }
      },
      constraints: [
        {
          type: 'component-whitelist',
          description: 'Only use approved form components',
          rule: { allowedComponents: ['Form', 'Input', 'Textarea', 'Button'] }
        },
        {
          type: 'prop-validation',
          description: 'All form fields must have validation',
          rule: { requireValidation: true }
        }
      ],
      context: {
        userType: 'developer',
        experienceLevel: 'intermediate',
        projectType: 'web-app',
        designSystem: 'custom'
      }
    },
    expectedUAST: {
      type: 'component',
      name: 'Form',
      props: {
        onSubmit: 'handleSubmit'
      },
      children: [
        {
          type: 'component',
          name: 'Input',
          props: {
            label: 'Name',
            type: 'text',
            required: true,
            value: 'formData.name',
            onChange: 'handleNameChange'
          },
          metadata: {
            framework: 'multi-framework',
            validation: ['required']
          }
        },
        {
          type: 'component',
          name: 'Input',
          props: {
            label: 'Email',
            type: 'email',
            required: true,
            value: 'formData.email',
            onChange: 'handleEmailChange'
          },
          metadata: {
            framework: 'multi-framework',
            validation: ['required', 'email']
          }
        },
        {
          type: 'component',
          name: 'Textarea',
          props: {
            label: 'Message',
            required: true,
            value: 'formData.message',
            onChange: 'handleMessageChange'
          },
          metadata: {
            framework: 'multi-framework',
            validation: ['required']
          }
        },
        {
          type: 'component',
          name: 'Button',
          props: {
            type: 'submit',
            disabled: '!isFormValid',
            children: 'Send Message'
          },
          metadata: {
            framework: 'multi-framework'
          }
        }
      ],
      metadata: {
        framework: 'multi-framework',
        semanticRole: 'form',
        accessibility: {
          role: 'form',
          ariaLabel: 'Contact form'
        }
      }
    },
    expectedCode: {
      react: {
        component: `import React, { useState, useCallback } from 'react';

interface FormData {
  name: string;
  email: string;
  message: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  message?: string;
}

export const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    message: ''
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = useCallback((name: keyof FormData, value: string): string | undefined => {
    switch (name) {
      case 'name':
        return value.trim() ? undefined : 'Name is required';
      case 'email':
        if (!value.trim()) return 'Email is required';
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        return emailRegex.test(value) ? undefined : 'Please enter a valid email';
      case 'message':
        return value.trim() ? undefined : 'Message is required';
      default:
        return undefined;
    }
  }, []);

  const handleFieldChange = useCallback((name: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [touched, validateField]);

  const handleFieldBlur = useCallback((name: keyof FormData) => () => {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, formData[name]);
    setErrors(prev => ({ ...prev, [name]: error }));
  }, [formData, validateField]);

  const isFormValid = Object.values(formData).every(value => value.trim()) &&
                     Object.values(errors).every(error => !error);

  const handleSubmit = useCallback((event: React.FormEvent) => {
    event.preventDefault();
    
    // Validate all fields
    const newErrors: FormErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key as keyof FormData, formData[key as keyof FormData]);
      if (error) newErrors[key as keyof FormErrors] = error;
    });

    setErrors(newErrors);
    setTouched({ name: true, email: true, message: true });

    if (Object.keys(newErrors).length === 0) {
      // Submit form
      console.log('Form submitted:', formData);
      alert('Message sent successfully!');
      setFormData({ name: '', email: '', message: '' });
      setTouched({});
    }
  }, [formData, validateField]);

  return (
    <form onSubmit={handleSubmit} className="contact-form" noValidate>
      <div className="form-group">
        <label htmlFor="name">Name *</label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={handleFieldChange('name')}
          onBlur={handleFieldBlur('name')}
          className={\`form-control \${errors.name ? 'error' : ''}\`}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <div id="name-error" className="error-message" role="alert">
            {errors.name}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="email">Email *</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={handleFieldChange('email')}
          onBlur={handleFieldBlur('email')}
          className={\`form-control \${errors.email ? 'error' : ''}\`}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <div id="email-error" className="error-message" role="alert">
            {errors.email}
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="message">Message *</label>
        <textarea
          id="message"
          value={formData.message}
          onChange={handleFieldChange('message')}
          onBlur={handleFieldBlur('message')}
          className={\`form-control \${errors.message ? 'error' : ''}\`}
          rows={4}
          aria-describedby={errors.message ? 'message-error' : undefined}
        />
        {errors.message && (
          <div id="message-error" className="error-message" role="alert">
            {errors.message}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!isFormValid}
        className="btn btn-primary"
      >
        Send Message
      </button>
    </form>
  );
};`,
        styles: `.contact-form {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-control:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.form-control.error {
  border-color: #dc3545;
}

.error-message {
  color: #dc3545;
  font-size: 12px;
  margin-top: 4px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}`
      }
    },
    testCases: [
      {
        id: 'form-validation-test',
        name: 'Form Validation',
        type: 'integration',
        description: 'Test form validation for all fields',
        steps: [
          { action: 'render', target: 'ContactForm' },
          { action: 'click', target: 'submit button' },
          { action: 'input', target: 'name field', input: 'John Doe' },
          { action: 'input', target: 'email field', input: 'invalid-email' },
          { action: 'blur', target: 'email field' }
        ],
        assertions: [
          { type: 'text', target: 'name error', expected: 'Name is required' },
          { type: 'text', target: 'email error', expected: 'Please enter a valid email' },
          { type: 'attribute', target: 'submit button', expected: { disabled: true } }
        ],
        expectedResults: [
          { type: 'validation', expected: 'Error messages shown for invalid fields' }
        ]
      },
      {
        id: 'form-submit-test',
        name: 'Form Submission',
        type: 'e2e',
        description: 'Test successful form submission',
        steps: [
          { action: 'render', target: 'ContactForm' },
          { action: 'input', target: 'name field', input: 'John Doe' },
          { action: 'input', target: 'email field', input: 'john@example.com' },
          { action: 'input', target: 'message field', input: 'Hello world' },
          { action: 'click', target: 'submit button' }
        ],
        assertions: [
          { type: 'event', target: 'onSubmit', expected: 'called' },
          { type: 'text', target: 'name field', expected: '' }
        ],
        expectedResults: [
          { type: 'interaction', expected: 'Form submitted and reset' }
        ]
      }
    ],
    metadata: {
      difficulty: 5,
      estimatedTime: 45,
      tags: ['form', 'validation', 'accessibility', 'state-management'],
      author: 'KPC Team',
      reviewers: ['reviewer1', 'reviewer2'],
      validationStatus: 'validated',
      usageCount: 85,
      successRate: 0.92,
      commonErrors: ['Missing validation', 'Incorrect error handling', 'Accessibility issues'],
      relatedEntries: ['basic-input-001', 'advanced-form-001']
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
    version: '1.0.0'
  }

  // Additional entries would be added here for advanced and edge-case scenarios
];

export default sampleEntries;